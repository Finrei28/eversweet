import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createOfferSchema, updateOfferSchema } from "~/app/components/schemas";
import { canActivate, hasEnded } from "~/lib/offers";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

/**
 * Authoring surface for offers. Nothing in this repo *serves* them - offers are a
 * customer mobile app feature, fetched from the order server, and the website's own
 * checkout discounts with Promo instead. So there is no cache to revalidate here and no
 * pricing path to keep in step; these procedures write rows the order server reads.
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
  limit: true,
  renewsWeekly: true,
  // The nested objects rather than the raw FK columns: the table renders the name and
  // the edit form reads `offer.dessert?.id` back out of them.
  dessert: { select: { id: true, name: true, chineseName: true } },
  category: { select: { id: true, name: true, chineseName: true } },
  requirements: {
    select: {
      id: true,
      quantity: true,
      dessert: { select: { id: true, name: true, chineseName: true } },
      category: { select: { id: true, name: true, chineseName: true } },
    },
    orderBy: { id: "asc" },
  },
  _count: { select: { redemptions: true } },
} as const;

/** The scalar half of an offer, shared by create and update. */
const offerScalars = (data: z.infer<typeof createOfferSchema>) => ({
  name: data.name,
  description: data.description ?? null,
  image: data.image,
  isActive: data.isActive,
  startsAt: data.startsAt,
  endsAt: data.endsAt,
  audience: data.audience,
  itemPriceInCents: data.itemPriceInCents,
  discountAmount: data.discountAmount,
  limit: data.limit,
  renewsWeekly: data.renewsWeekly,
  dessertId: data.dessertId,
  categoryId: data.categoryId,
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
   */
  getOffers: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.offer.findMany({
      relationLoadStrategy: "join",
      orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
      select: offerSelect,
    });
  }),

  createOffer: protectedProcedure
    .input(z.object({ offer: createOfferSchema }))
    .mutation(async ({ ctx, input }) => {
      const data = input.offer;

      // No redemption reset: a brand new offer has none.
      const offer = await ctx.db.offer.create({
        data: {
          ...offerScalars(data),
          requirements: {
            create: data.requirements.map((r) => ({
              quantity: r.quantity,
              dessertId: r.dessertId,
              categoryId: r.categoryId,
            })),
          },
        },
        select: { id: true, name: true },
      });

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

      return ctx.db.$transaction(async (tx) => {
        const existing = await tx.offer.findUnique({
          where: { id: data.id },
          select: {
            id: true,
            endsAt: true,
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
         * Requirements are patched, not replaced.
         *
         * Deleting them all and recreating - the way editProduct handles a dessert's
         * ingredients - would hand every row a new id on every save. The order server
         * reads these rows on each eligibility check, so stable ids are worth the diff.
         */
        const keptIds = data.requirements
          .map((r) => r.id)
          .filter((id): id is string => !!id);

        const removed = existing.requirements
          .map((r) => r.id)
          .filter((id) => !keptIds.includes(id));

        if (removed.length > 0) {
          await tx.offerRequirement.deleteMany({
            where: { id: { in: removed } },
          });
        }

        for (const requirement of data.requirements) {
          const values = {
            quantity: requirement.quantity,
            dessertId: requirement.dessertId,
            categoryId: requirement.categoryId,
          };

          // The result is discarded either way, so name a single column rather than
          // having Prisma return - and therefore SELECT - every field on the row.
          if (requirement.id) {
            await tx.offerRequirement.update({
              where: { id: requirement.id },
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
          data: offerScalars(data),
          select: { id: true, name: true },
        });

        return offer;
      });
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
      return ctx.db.$transaction(async (tx) => {
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
         * The order server does not honour `endsAt` yet (see OUTSTANDING.md), so an
         * offer this admin calls "ended" is still live to the mobile app until
         * `isActive` goes false. Deleting the redemptions first would re-open it to
         * everyone for as long as that gap lasted. Both statements share a transaction,
         * so there is no gap at all - the ordering is belt and braces for the day
         * somebody splits them.
         */
        await tx.offer.update({
          where: { id: input.id },
          data: { isActive: false, endsAt: null },
          select: { id: true },
        });

        const { count } = await tx.offerRedemption.deleteMany({
          where: { offerId: input.id },
        });

        return { name: before.name, redemptionsCleared: count };
      });
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

      return offer;
    }),
});
