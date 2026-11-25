import { type Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import {
  createOfferSchema,
  type offerRequirementSchema,
  updateOfferSchema,
} from "~/app/components/schemas";
import { endOfDayNZ, startOfDayNZ } from "~/lib/aucklandDay";
import { formatCurrency } from "~/lib/formatters";
import { canActivate, hasEnded } from "~/lib/offers";
import {
  cheapestDessert,
  comboCeiling,
  describeComboCeiling,
  isUnderListPrice,
} from "~/lib/offerPricing";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { APP_OFFER_TAG } from "~/server/appOffer";

/**
 * Authoring surface for offers. Nothing in this repo *serves* them - offers are a
 * customer mobile app feature, fetched from the order server, and the website's own
 * checkout discounts with Promo instead. So there is no pricing path to keep in step;
 * these procedures write rows the order server reads.
 *
 * The one cache: the website's app-offer pop-up reads the live sago offer
 * (`~/server/appOffer`) to advertise it, never to price with it. Every write here
 * revalidates its tag once it has committed, so a paused, archived or edited offer stops
 * being advertised at once rather than after the cache's five minutes.
 *
 * protectedProcedure is the admin gate. Only ADMIN users can authenticate on this site
 * at all - src/server/auth/config.ts `authorize()` returns null for everyone else - so
 * "signed in" and "is an admin" are the same statement. If that ever stops being true,
 * every procedure in this file needs a role check before it is deployed.
 *
 * There is deliberately no delete. OrderDessert.offer and CartItem.offer both cascade
 * *from* Offer, so `offer.delete()` takes the order lines that used it - completed
 * orders, revenue, past-order detail - with it. OfferRequirement.offer meanwhile has no
 * onDelete, so it is RESTRICT and blocks the delete only while requirements exist,
 * which means a delete either throws or eats sales history depending on unrelated
 * state. Archiving is the supported way to retire an offer.
 */

/**
 * A fixed offer price has to come in under what the thing normally costs - equal is not
 * an offer and above it is a surcharge.
 *
 * This rule cannot live where the other two do. `hasExactlyOnePrice` and the 1-100 range
 * read one row, so a CHECK constraint holds them; this one compares against
 * `Dessert.priceInCents` in another table, and a PostgreSQL CHECK cannot contain a
 * subquery. So it is enforced here, and mirrored in the dialog so the admin is told
 * before they submit rather than after.
 *
 * It is also the one rule that can come untrue on its own: drop a dessert's price below
 * an offer's fixed price and a row that was valid when written is no longer. Nothing
 * re-checks existing offers, and this deliberately does not either - it would mean an
 * unrelated price edit could refuse to save because of an old offer.
 */
type OfferScope = {
  dessertId: string | null;
  categoryId: string | null;
  excludedDessertIds: string[];
};

/**
 * What the offer leaves out, as it will be stored, checked.
 *
 * - Only against a category, and once each. An offer switched from a category to one
 *   dessert drops its list, so switching back later does not bring back exclusions the
 *   form had stopped showing.
 * - A save that sends no list keeps the stored one while the category is unchanged. That
 *   is a tab opened before exclusions existed, which never showed the list.
 * - Every id sent has to be a dessert in the category, and something has to be left. The
 *   order server filters the category by these ids, so an id from elsewhere would sit
 *   there excluding nothing while the admin believed it worked, and excluding the lot puts
 *   an offer on the app whose "choose an item" sheet is empty.
 * - Except an id already stored that has since left the category (moved, or deleted): it
 *   is dropped. The dialog lists only the category's desserts, so it sends that id back
 *   without showing it, and refusing it blocked every save of the offer.
 *
 * `current` is the offer as stored, or null for a new one.
 */
const resolveExclusions = async (
  db: Prisma.TransactionClient,
  data: Omit<OfferScope, "excludedDessertIds"> & {
    excludedDessertIds?: string[];
  },
  current: { categoryId: string | null; excludedDessertIds: string[] } | null,
): Promise<string[]> => {
  if (!data.categoryId || data.dessertId) return [];

  const stored =
    current?.categoryId === data.categoryId ? current.excludedDessertIds : [];
  const excluded = Array.from(new Set(data.excludedDessertIds ?? stored));
  if (excluded.length === 0) return [];

  const inCategory = await db.dessert.findMany({
    where: { categoryId: data.categoryId },
    select: { id: true },
  });
  const ids = new Set(inCategory.map((dessert) => dessert.id));

  const kept = excluded.filter((id) => ids.has(id) || !stored.includes(id));
  if (kept.length === 0) return [];

  if (kept.some((id) => !ids.has(id))) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "One of the desserts left out is not in this offer's category. Reopen the offer and choose again.",
    });
  }

  if (inCategory.every((dessert) => kept.includes(dessert.id))) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "An offer cannot leave out every dessert in its category - it would have nothing to offer.",
    });
  }

  return kept;
};

const assertUnderListPrice = async (
  db: Prisma.TransactionClient,
  data: OfferScope & { itemPriceInCents: number | null },
) => {
  if (data.itemPriceInCents === null) return;

  // Scope first. `where: undefined` would match the entire menu and take the ceiling
  // from the cheapest dessert in the shop, which is not what either branch means. A
  // dessert the offer leaves out is not something it undercuts, so it sets no ceiling.
  const where = data.dessertId
    ? { id: data.dessertId }
    : data.categoryId
      ? { categoryId: data.categoryId, id: { notIn: data.excludedDessertIds } }
      : null;

  // An offer that names neither has nothing to undercut, so there is no rule to break.
  if (where === null) return;

  const desserts = await db.dessert.findMany({
    where,
    select: { name: true, priceInCents: true },
  });

  const cheapest = cheapestDessert(desserts);

  if (
    cheapest !== null &&
    !isUnderListPrice(data.itemPriceInCents, cheapest.priceInCents)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        `A fixed price has to be under what the item normally costs. ` +
        `${cheapest.name} is ${formatCurrency(cheapest.priceInCents / 100)}` +
        `, so this offer has to be less than that.`,
    });
  }
};

/**
 * Rule 3 for a combo: its set has to cost less than the cheapest dessert each part can take,
 * added up. Like `assertUnderListPrice`, it compares against another table, so neither zod
 * nor a CHECK constraint can hold it. The message names the sum, so the admin knows what to
 * beat: "Mochi Series from $9.50 + Sago Series from $8.00 = $17.50".
 *
 * The order server refuses picks that come to less than the combo at add-to-cart, since a
 * menu price can drop after this check.
 */
const assertComboUnderCeiling = async (
  db: Prisma.TransactionClient,
  data: {
    comboPriceInCents: number | null;
    comboSlots: { dessertId: string | null; categoryId: string | null }[];
  },
) => {
  if (data.comboPriceInCents === null) return;

  const dessertIds = data.comboSlots.flatMap((slot) =>
    slot.dessertId ? [slot.dessertId] : [],
  );
  const categoryIds = data.comboSlots.flatMap((slot) =>
    slot.categoryId ? [slot.categoryId] : [],
  );
  const [desserts, categories] = await Promise.all([
    db.dessert.findMany({
      where: {
        OR: [{ id: { in: dessertIds } }, { categoryId: { in: categoryIds } }],
      },
      select: { id: true, name: true, priceInCents: true, categoryId: true },
    }),
    db.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    }),
  ]);

  const names = new Map(categories.map((category) => [category.id, category.name]));
  const ceiling = comboCeiling(
    data.comboSlots,
    desserts,
    (id) => names.get(id) ?? "that category",
  );

  if (
    ceiling !== null &&
    !isUnderListPrice(data.comboPriceInCents, ceiling.totalCents)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        `A combo has to cost less than its cheapest picks bought on their own: ` +
        `${describeComboCeiling(ceiling)}, so this combo has to be under ` +
        `${formatCurrency(ceiling.totalCents / 100)}.`,
    });
  }
};

/** A combo's parts as rows, numbered from 0 in the order they were given. */
const comboSlotRows = (
  slots: { dessertId: string | null; categoryId: string | null }[],
) =>
  slots.map((slot, position) => ({
    position,
    dessertId: slot.dessertId,
    categoryId: slot.categoryId,
  }));

const offerSelect = {
  id: true,
  name: true,
  description: true,
  image: true,
  isActive: true,
  startsAt: true,
  endsAt: true,
  archivedAt: true,
  audience: true,
  itemPriceInCents: true,
  discountAmount: true,
  comboPriceInCents: true,
  // A combo's parts, in order, named for the table and read back by the edit form.
  comboSlots: {
    select: {
      position: true,
      dessert: { select: { id: true, name: true, chineseName: true } },
      category: { select: { id: true, name: true, chineseName: true } },
    },
    orderBy: { position: "asc" },
  },
  limit: true,
  renewsWeekly: true,
  // The nested objects rather than the raw FK columns: the table renders the name and
  // the edit form reads `offer.dessert?.id` back out of them.
  dessert: { select: { id: true, name: true, chineseName: true } },
  category: { select: { id: true, name: true, chineseName: true } },
  excludedDessertIds: true,
  requirements: {
    select: {
      id: true,
      quantity: true,
      minSpendInCents: true,
      dessert: { select: { id: true, name: true, chineseName: true } },
      category: { select: { id: true, name: true, chineseName: true } },
    },
    orderBy: { id: "asc" },
  },
  _count: { select: { redemptions: true } },
} as const;

/**
 * The scalar half of an offer, shared by create and update.
 *
 * The dates arrive as the calendar days the admin picked and are stored as the span of
 * those days in Auckland: live from midnight at the start of the first, through the last
 * millisecond of the last. Both apps compare the bounds inclusively, so an offer ending
 * on the 31st is served all of the 31st.
 */
const offerScalars = (
  data: z.infer<typeof createOfferSchema>,
  excludedDessertIds: string[],
) => ({
  name: data.name,
  description: data.description ?? null,
  image: data.image,
  isActive: data.isActive,
  startsAt: data.startsOn === null ? null : startOfDayNZ(data.startsOn),
  endsAt: data.endsOn === null ? null : endOfDayNZ(data.endsOn),
  audience: data.audience,
  itemPriceInCents: data.itemPriceInCents,
  discountAmount: data.discountAmount,
  comboPriceInCents: data.comboPriceInCents,
  limit: data.limit,
  renewsWeekly: data.renewsWeekly,
  dessertId: data.dessertId,
  categoryId: data.categoryId,
  excludedDessertIds,
});

/**
 * A requirement row's columns, shared by create and update so a column added to one
 * cannot be missed by the other.
 *
 * A spend row stores a quantity of 1 whatever it was sent. Nothing reads it there, and a
 * row switched from "3 x Mango sago" to a spend would otherwise keep a 3 that reads like it
 * means something.
 */
const requirementValues = (
  requirement: z.infer<typeof offerRequirementSchema>,
) => ({
  dessertId: requirement.dessertId,
  categoryId: requirement.categoryId,
  minSpendInCents: requirement.minSpendInCents,
  quantity: requirement.minSpendInCents === null ? requirement.quantity : 1,
});

export const offerRouter = createTRPCRouter({
  /**
   * Every offer, archived ones included - the table filters them client-side so the
   * "Show archived" toggle is instant rather than a refetch.
   *
   * This used to take an `includeArchived` flag defaulting to false, which meant archived
   * rows were never fetched at all and the toggle silently did nothing. Taking no input
   * also removes the hazard entirely: `prefetch()` and `useSuspenseQuery()` must be
   * called with identical inputs or the cache key misses, and there is now no input to
   * get wrong. Offers are a handful of rows, so fetching the archived ones is free.
   *
   * `orderCount` is how many orders used each offer, cancelled ones left out, over every
   * run. The table's count used to be `_count.redemptions`, the redemption rows, which is
   * who has touched the offer rather than how often it was had: the order server takes a
   * use when the offer goes into the cart, and every way of handing it back - out of the
   * cart, the cart swept, the order cancelled - lowers the row's counter and keeps the row.
   * A gated offer's row is written when it is unlocked, before any use. `_count` stays for
   * Close run, which deletes those rows and says how many.
   */
  getOffers: protectedProcedure.query(async ({ ctx }) => {
    const [offers, offerOrders] = await Promise.all([
      ctx.db.offer.findMany({
        relationLoadStrategy: "join",
        orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
        select: offerSelect,
      }),
      // One row per order and offer it used, so an order with two lines on the same offer
      // (each use is its own line) counts once.
      ctx.db.orderDessert.groupBy({
        by: ["offerId", "orderId"],
        where: {
          offerId: { not: null },
          order: { status: { not: "CANCELLED" } },
        },
      }),
    ]);

    const orderCount = new Map<string, number>();
    for (const { offerId } of offerOrders) {
      if (offerId) orderCount.set(offerId, (orderCount.get(offerId) ?? 0) + 1);
    }

    return offers.map((offer) => ({
      ...offer,
      orderCount: orderCount.get(offer.id) ?? 0,
    }));
  }),

  createOffer: protectedProcedure
    .input(z.object({ offer: createOfferSchema }))
    .mutation(async ({ ctx, input }) => {
      const data = input.offer;

      const excludedDessertIds = await resolveExclusions(ctx.db, data, null);
      await assertUnderListPrice(ctx.db, { ...data, excludedDessertIds });
      await assertComboUnderCeiling(ctx.db, data);

      // No redemption reset: a brand new offer has none.
      const offer = await ctx.db.offer.create({
        data: {
          ...offerScalars(data, excludedDessertIds),
          requirements: { create: data.requirements.map(requirementValues) },
          comboSlots: { create: comboSlotRows(data.comboSlots) },
        },
        select: { id: true, name: true },
      });

      revalidateTag(APP_OFFER_TAG);
      return offer;
    }),

  /**
   * Edits content and nothing else.
   *
   * Emphatically does not touch redemptions: fixing a typo in an offer's name must not
   * re-grant it to everyone who has already used it. Clearing a run is an explicit,
   * confirmed act - see `closeRun`.
   */
  updateOffer: protectedProcedure
    .input(z.object({ offer: updateOfferSchema }))
    .mutation(async ({ ctx, input }) => {
      const data = input.offer;

      const saved = await ctx.db.$transaction(async (tx) => {
        const existing = await tx.offer.findUnique({
          where: { id: data.id },
          select: {
            id: true,
            endsAt: true,
            categoryId: true,
            excludedDessertIds: true,
            comboPriceInCents: true,
            requirements: { select: { id: true } },
          },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Offer not found",
          });
        }

        /**
         * A finished run cannot be edited, and this is the guard the whole design rests
         * on. Without it an admin could simply push `endsAt` into the future, which
         * takes the offer live again with nobody's redemption cleared - and because the
         * edit destroys the evidence that it had ended, no later check could tell.
         *
         * Close run is the only way out, and clearing `endsAt` is what lifts this block.
         */
        if (hasEnded(existing)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "This offer's run has ended. Close the run first - that clears redemptions so customers can earn it again.",
          });
        }

        /**
         * An offer stays what it was made as. The order server tells a combo from a single
         * offer by `comboPriceInCents`, and a cart or order line under it by its `comboId`:
         * switched, every line already holding the offer would mean something else. Archive
         * it and make a new one instead.
         */
        if ((existing.comboPriceInCents === null) !== (data.comboPriceInCents === null)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              existing.comboPriceInCents === null
                ? "A single-item offer can't become a combo. Archive it and create a combo instead."
                : "A combo can't become a single-item offer. Archive it and create a new offer instead.",
          });
        }

        const excludedDessertIds = await resolveExclusions(tx, data, existing);
        await assertUnderListPrice(tx, { ...data, excludedDessertIds });
        await assertComboUnderCeiling(tx, data);

        /**
         * A combo's parts are replaced, not patched: nothing outside this offer keeps a slot's
         * id (cart and order lines are matched to slots as a set), so there is nothing a new
         * id breaks. Changing a running combo's parts or price takes it out of every cart
         * holding it on their next load, as the owner chose - the dialog says so.
         */
        if (data.comboPriceInCents !== null) {
          await tx.offerComboSlot.deleteMany({ where: { offerId: data.id } });
          await tx.offerComboSlot.createMany({
            data: comboSlotRows(data.comboSlots).map((row) => ({
              ...row,
              offerId: data.id,
            })),
          });
        }

        /**
         * Requirements are patched, not replaced.
         *
         * Deleting them all and recreating - the way editProduct handles a dessert's
         * ingredients - would hand every row a new id on every save. The order server
         * reads these rows on each eligibility check, so stable ids are worth the diff.
         */
        const keptIds = data.requirements
          .map((r) => r.id)
          .filter((id): id is string => !!id);

        /**
         * Every id sent has to be one of this offer's requirements. The update below
         * found its row by id alone, so another offer's id rewrote that offer's
         * requirement, and one removed by a save made since this form opened failed as a
         * 500 with Prisma's message. Both are refused before anything is written.
         */
        const heldIds = new Set(existing.requirements.map((r) => r.id));
        if (keptIds.some((id) => !heldIds.has(id))) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "This offer's requirements have changed since it was opened. Close it, open it again and make your change again.",
          });
        }

        const removed = existing.requirements
          .map((r) => r.id)
          .filter((id) => !keptIds.includes(id));

        if (removed.length > 0) {
          await tx.offerRequirement.deleteMany({
            where: { id: { in: removed } },
          });
        }

        for (const requirement of data.requirements) {
          const values = requirementValues(requirement);

          // The result is discarded either way, so name a single column rather than
          // having Prisma return - and therefore SELECT - every field on the row.
          if (requirement.id) {
            // `offerId` as well as the id, so this can never reach another offer's row
            // even if the check above is ever loosened.
            await tx.offerRequirement.update({
              where: { id: requirement.id, offerId: data.id },
              data: values,
              select: { id: true },
            });
          } else {
            await tx.offerRequirement.create({
              data: { ...values, offerId: data.id },
              select: { id: true },
            });
          }
        }

        const offer = await tx.offer.update({
          where: { id: data.id },
          data: offerScalars(data, excludedDessertIds),
          select: { id: true, name: true },
        });

        return offer;
      });

      revalidateTag(APP_OFFER_TAG);
      return saved;
    }),

  /**
   * A plain pause switch. Deliberately does **not** touch redemptions.
   *
   * Pausing and resuming inside an offer's window is a shop-side decision that customers
   * should never pay for: an admin who switches an offer off by accident and back on
   * costs nobody their unlock. Clearing redemptions happens only when a run is
   * deliberately closed - see `closeRun`.
   */
  setActive: protectedProcedure
    .input(z.object({ id: z.string().min(1), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.offer.findUnique({
        where: { id: input.id },
        select: { id: true, name: true, endsAt: true },
      });

      if (!before) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Offer not found" });
      }

      // Refuse rather than silently doing nothing: an offer switched on with a past end
      // date is flagged active and still will not run, which reads as a bug from behind
      // the counter.
      if (input.active && !canActivate(before)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This offer's run has ended. Close the run to clear it and set new dates.",
        });
      }

      await ctx.db.offer.update({
        where: { id: input.id },
        data: input.active
          ? { isActive: true, archivedAt: null }
          : { isActive: false },
        // Explicit, like every other query here. Without a `select` Prisma returns the
        // whole row, so the UPDATE names every column the *client* knows about - and a
        // client generated from a schema whose migration has not been applied yet then
        // asks for a column the database does not have. `prisma generate` runs as part
        // of `npm run build`, so that skew is one command away at any time.
        select: { id: true },
      });

      revalidateTag(APP_OFFER_TAG);
      return { name: before.name };
    }),

  /**
   * Ends a run and clears it, so the offer can be put out again as a fresh one.
   *
   * This is the only procedure that touches redemption rows, and it deletes them rather
   * than resetting them to AVAILABLE. That distinction is the whole point for an offer
   * with requirements: deleting restores `redemptions: { none: { userId } }`, so the
   * order server's unlock pass re-evaluates the requirements against a real qualifying
   * order (auth.controller.ts:936). Resetting to AVAILABLE would instead hand the offer
   * straight back to everyone who had already earned it once - the requirements would
   * only ever gate the very first run.
   *
   * Clearing `endsAt` is not incidental: a past end date is what blocks editing, so
   * clearing it is what lets the admin set the new run's dates afterwards.
   */
  closeRun: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const closed = await ctx.db.$transaction(async (tx) => {
        const before = await tx.offer.findUnique({
          where: { id: input.id },
          select: { id: true, name: true, endsAt: true },
        });

        if (!before) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Offer not found",
          });
        }

        if (!hasEnded(before)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "This offer has not ended yet. Only a finished run can be closed.",
          });
        }

        /**
         * Stop serving it BEFORE clearing the run.
         *
         * Clearing `endsAt` takes away the one thing that stops the order server serving
         * this offer, so `isActive` has to go false in the same breath. Deleting the
         * redemptions first would re-open it to everyone for as long as that gap lasted.
         * Both statements share a transaction, so there is no gap at all - the ordering is
         * belt and braces for the day somebody splits them.
         */
        await tx.offer.update({
          where: { id: input.id },
          // notifiedAt goes back to null with the rest of it. Closing a run is the one
          // action that deliberately starts an offer over - redemptions cleared, dates
          // cleared - so its next run should be announced to customers like a new offer,
          // which is what it is to anyone who missed the first.
          data: { isActive: false, endsAt: null, notifiedAt: null },
          select: { id: true },
        });

        const { count } = await tx.offerRedemption.deleteMany({
          where: { offerId: input.id },
        });

        return { name: before.name, redemptionsCleared: count };
      });

      revalidateTag(APP_OFFER_TAG);
      return closed;
    }),

  /**
   * Archive and restore. Neither resets redemptions.
   *
   * Archiving also switches the offer off, so restoring brings it back paused - going
   * live again is then a deliberate second action through `setActive`, which is where
   * the reset and its confirmation live.
   */
  setArchived: protectedProcedure
    .input(z.object({ id: z.string().min(1), archived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const offer = await ctx.db.offer.update({
        where: { id: input.id },
        data: input.archived
          ? { archivedAt: new Date(), isActive: false }
          : { archivedAt: null },
        select: { id: true, name: true },
      });

      revalidateTag(APP_OFFER_TAG);
      return offer;
    }),
});
