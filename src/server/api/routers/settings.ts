import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import {
  leaderboardVisibilitySchema,
  loyaltyRatesSchema,
  pointsExpirySchema,
  membershipBenefitsSchema,
  saveAnnouncementsSchema,
  saveDaysOffSchema,
  shopProfileSchema,
} from "~/app/components/schemas";
import { endOfDayNZ, startOfDayNZ, todayNZ } from "~/lib/aucklandDay";
import { formatDayOff } from "~/lib/daysOff";
import { nzDayKey } from "~/lib/pickUpTimes";
import { benefitsClaimingOtherMultiplier } from "~/lib/shopSettings";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { db as Db } from "~/server/db";
import { DAYS_OFF_TAG } from "~/server/pickUpTimes";
import { SHOP_PROFILE_TAG } from "~/server/shopProfile";

/**
 * Authoring surface for the shop settings that used to be compiled into the order server:
 * the loyalty earn rates, the membership benefits, the launch announcements and the shop's
 * own details. They moved into the database so the shop can change them without a deploy,
 * and they are edited here rather than in the staff app deliberately - the tablet on the
 * counter adjusts preparation times as service speeds up or slows down, but nobody standing
 * in the shop should be able to reword a membership or change what an order earns.
 *
 * These write rows directly rather than calling the order server's /api/internal, unlike
 * /admin/winners. That hop exists because the order server holds guards the website cannot
 * reproduce - minting a prize code, pushing a notification, refusing a collected prize.
 * Nothing here has an equivalent, so a second network call would only add a way to fail.
 *
 * **The order server sees a change within a minute, not immediately.** It caches each of
 * these in memory for 60 seconds (`lib/loyaltyRates`, `lib/storeInfo`, `lib/announcements`),
 * exactly as it already does for the trading hours, because a writer in this repo cannot
 * invalidate a cache in that process. So save changes outside trading hours if the timing
 * matters, the same advice as for the hours.
 *
 * protectedProcedure is the admin gate. Only ADMIN users can authenticate on this site at
 * all - src/server/auth/config.ts `authorize()` returns null for everyone else - so "signed
 * in" and "is an admin" are the same statement. If that ever stops being true, every
 * procedure in this file needs a role check before it is deployed.
 */

/** The singleton id both settings rows are seeded with, as PrepTimeSetting is. */
const SINGLETON_ID = "default";

/**
 * Takes turns on saving the announcements, for the rest of `tx`.
 *
 * The save checks the list it was opened from against what is there, then replaces it. At
 * READ COMMITTED those are two separate moments, so two admins saving together both passed
 * the check against the same rows: one's deletion then broke the other's update, which
 * answered a 500 rather than the "reload" the check exists to give. Holding this, the
 * second save waits for the first to commit, then sees its changes and is refused cleanly.
 *
 * Exported so a test can hold it. Same form as `lockPayment`.
 */
export const lockAnnouncements = (tx: Prisma.TransactionClient) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('settings:announcements', 0))`;

/**
 * Takes turns on saving days off, for the rest of `tx`.
 *
 * `DaysOff` has no unique day - it cannot, as a day is an Auckland date and the column an
 * instant - so the save reads which days are off and then inserts the rest. Two admins
 * adding the same day together both found no row and wrote one each.
 *
 * The staff app saves through the order server, which does not take this lock, so a tablet
 * and this page closing the same day in the same instant can still write it twice. That is
 * harmless: every reader matches days off by day, and reopening one deletes every row on it.
 *
 * Exported so a test can hold it.
 */
export const lockDaysOff = (tx: Prisma.TransactionClient) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('settings:days-off', 0))`;

/**
 * Days off from today on the Auckland calendar, each once, in order. Earlier ones are left
 * in the table and off this screen: they are history, and nothing reads them for an order.
 */
const upcomingDaysOff = async (db: typeof Db): Promise<string[]> => {
  const rows = await db.daysOff.findMany({
    where: { date: { gte: startOfDayNZ(todayNZ()) } },
    select: { date: true },
  });
  return [...new Set(rows.map((row) => nzDayKey(row.date)))].sort();
};

/** An order is still the shop's to make or hand over until it is collected or called off. */
const OPEN_ORDER_STATUSES = ["PENDING", "ACCEPTED", "MAKING", "READY"] as const;

export const settingsRouter = createTRPCRouter({
  /**
   * The rates as whole numbers, which is how they are stored and how the form edits them.
   * The conversion to the `{ rate, memberRate, modifier }` the app receives happens in the
   * order server, at the edge, so there is only ever one place that divides by 100.
   */
  getLoyaltyRates: protectedProcedure.query(async ({ ctx }) => {
    const row = await ctx.db.loyaltySetting.findFirst({
      select: {
        pointsPerDollar: true,
        memberBonusPercent: true,
        modifierPercent: true,
      },
    });

    // The order server falls back to the values that used to be hardcoded when the row is
    // missing, so the form shows those rather than an empty state an admin might save over.
    return (
      row ?? {
        pointsPerDollar: 6,
        memberBonusPercent: 150,
        modifierPercent: 100,
      }
    );
  }),

  saveLoyaltyRates: protectedProcedure
    .input(loyaltyRatesSchema)
    .mutation(async ({ ctx, input }) => {
      // One row, addressed the way the order server addresses its own singletons:
      // updateMany matches nothing on an unseeded table, so fall back to creating it
      // rather than silently doing nothing.
      const { count } = await ctx.db.loyaltySetting.updateMany({ data: input });
      if (count === 0) {
        await ctx.db.loyaltySetting.create({
          data: { id: SINGLETON_ID, ...input },
        });
      }
      return input;
    }),

  /**
   * Whether Sweet Points expire after a month without an app order, and since when.
   *
   * `pointsExpireFrom` is also every customer's launch grace: the order server counts nobody's
   * month from before it (`lib/pointsExpiry` there), so switching on gives everyone a full
   * month, whatever they last ordered.
   */
  getPointsExpiry: protectedProcedure.query(async ({ ctx }) => {
    const row = await ctx.db.loyaltySetting.findFirst({
      select: { pointsExpireFrom: true },
    });
    return { expireFrom: row?.pointsExpireFrom ?? null };
  }),

  /**
   * Switches expiry on or off.
   *
   * On stamps the moment, and only if it was off: saving "on" again must not quietly restart
   * everyone's month. Off clears it, which is also the pause for a long closure - and turning
   * it back on afterwards gives every customer a fresh month from that day, as the Terms say.
   */
  setPointsExpiry: protectedProcedure
    .input(pointsExpirySchema)
    .mutation(async ({ ctx, input }) => {
      if (!input.enabled) {
        await ctx.db.loyaltySetting.updateMany({
          data: { pointsExpireFrom: null },
        });
        return { expireFrom: null };
      }

      const now = new Date();
      await ctx.db.loyaltySetting.updateMany({
        where: { pointsExpireFrom: null },
        data: { pointsExpireFrom: now },
      });

      // Unseeded: nothing for the update to match, on or off. Create the row switched on,
      // the same fallback `saveLoyaltyRates` uses.
      const row = await ctx.db.loyaltySetting.findFirst({
        select: { pointsExpireFrom: true },
      });
      if (!row) {
        await ctx.db.loyaltySetting.create({
          data: { id: SINGLETON_ID, pointsExpireFrom: now },
        });
        return { expireFrom: now };
      }
      return { expireFrom: row.pointsExpireFrom };
    }),

  /**
   * Whether the customer app shows the monthly leaderboard, and since when it has been hidden.
   *
   * Hiding takes the board, last month's podium, the "prize being prepared" cards and the
   * prize push out of the app (the order server reads this with the loyalty rates). The
   * ranking, settling the month, assigning prizes here and collecting them carry on, so
   * showing it again picks up where it was. A prize already assigned stays in the app.
   */
  getLeaderboardVisibility: protectedProcedure.query(async ({ ctx }) => {
    const row = await ctx.db.loyaltySetting.findFirst({
      select: { leaderboardHiddenAt: true },
    });
    return { hiddenAt: row?.leaderboardHiddenAt ?? null };
  }),

  /**
   * Hides or shows it. Hiding stamps the moment only if it was shown, so a second click keeps
   * the date the card reports; showing clears it. Same shape as `setPointsExpiry`.
   */
  setLeaderboardVisibility: protectedProcedure
    .input(leaderboardVisibilitySchema)
    .mutation(async ({ ctx, input }) => {
      if (input.shown) {
        await ctx.db.loyaltySetting.updateMany({
          data: { leaderboardHiddenAt: null },
        });
        return { hiddenAt: null };
      }

      const now = new Date();
      await ctx.db.loyaltySetting.updateMany({
        where: { leaderboardHiddenAt: null },
        data: { leaderboardHiddenAt: now },
      });

      // Unseeded: create the row hidden, the same fallback `setPointsExpiry` uses.
      const row = await ctx.db.loyaltySetting.findFirst({
        select: { leaderboardHiddenAt: true },
      });
      if (!row) {
        await ctx.db.loyaltySetting.create({
          data: { id: SINGLETON_ID, leaderboardHiddenAt: now },
        });
        return { hiddenAt: now };
      }
      return { hiddenAt: row.leaderboardHiddenAt };
    }),

  getShopProfile: protectedProcedure.query(async ({ ctx }) => {
    const row = await ctx.db.shopProfile.findFirst({
      select: {
        name: true,
        address: true,
        city: true,
        state: true,
        postal: true,
        phone: true,
        email: true,
        website: true,
        about: true,
      },
    });

    return (
      row ?? {
        name: "Eversweet",
        address: "5D/119 Meadowland Drive, Somerville",
        city: "Auckland",
        state: "Auckland",
        postal: "2014",
        phone: "09 949 1050",
        email: "eversweet@eversweet.co.nz",
        website: "https://eversweet.co.nz",
        about: null,
      }
    );
  }),

  saveShopProfile: protectedProcedure
    .input(shopProfileSchema)
    .mutation(async ({ ctx, input }) => {
      // A blank About is stored as null, which the app reads as "show the text you were
      // built with", rather than as an empty paragraph under the heading. An absent one is
      // left alone: a tab opened before the field existed sends none, and reading that as
      // blank erased the paragraph whenever it saved the address.
      const data = {
        ...input,
        about: input.about === undefined ? undefined : input.about || null,
      };
      const { count } = await ctx.db.shopProfile.updateMany({ data });
      if (count === 0) {
        await ctx.db.shopProfile.create({
          data: { id: SINGLETON_ID, ...data },
        });
      }

      // This site shows the address and phone on its contact page and in its structured
      // data, both read through unstable_cache, so the change has to be published here as
      // well as written. The order server has its own one-minute cache and needs nothing.
      revalidateTag(SHOP_PROFILE_TAG);

      return input;
    }),

  /** The benefits of the one plan the app offers, in the order the app lists them. */
  getMembershipBenefits: protectedProcedure.query(async ({ ctx }) => {
    const plan = await ctx.db.membershipPlan.findFirst({
      where: { name: "Monthly_Membership" },
      select: { id: true, benefits: true },
    });

    return { id: plan?.id ?? null, benefits: plan?.benefits ?? [] };
  }),

  saveMembershipBenefits: protectedProcedure
    .input(membershipBenefitsSchema)
    .mutation(async ({ ctx, input }) => {
      // Scoped by name rather than taking an id from the browser: there is one plan, and
      // accepting an id would let a caller rewrite any other row this table ever gains.
      const { count } = await ctx.db.membershipPlan.updateMany({
        where: { name: "Monthly_Membership" },
        data: { benefits: input.benefits },
      });

      if (count === 0) {
        throw new Error(
          "There is no Monthly_Membership plan to attach benefits to.",
        );
      }

      return input;
    }),

  getAnnouncements: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.announcement.findMany({
      orderBy: [{ position: "asc" }, { publishedAt: "desc" }],
      select: {
        id: true,
        title: true,
        text1: true,
        text2: true,
        isActive: true,
        publishedAt: true,
        endsAt: true,
      },
    });

    // The stored instants, as they are. The card turns them into the calendar days they
    // fall on in Auckland with `calendarDate`, which only works in the browser: run here, on
    // a server in UTC, it sent midnight UTC, which a browser west of UTC shows - and saves -
    // as the day before. The offer dialog already converts in the browser.
    return rows;
  }),

  /**
   * Saves the whole list at once: the form reorders, adds and removes rows together, and
   * an announcement's position only means anything relative to its neighbours.
   *
   * A row keeps its `publishedAt` unless the admin moves the date. That is the field the
   * app compares against the last announcement it showed, so rewriting it on every save
   * would pop the modal for every customer each time a typo was fixed.
   */
  saveAnnouncements: protectedProcedure
    .input(saveAnnouncementsSchema)
    .mutation(async ({ ctx, input }) => {
      const keep = input.announcements
        .map((a) => a.id)
        .filter((id): id is string => Boolean(id));

      // Interactive rather than the array form, because the check below has to happen
      // inside the same transaction as the writes it guards.
      await ctx.db.$transaction(async (tx) => {
        await lockAnnouncements(tx);

        // Refuse a submission built from a list that has since changed. Saving replaces
        // the whole collection, so without this an admin whose form loaded before someone
        // else added an announcement would delete it on save - silently, with no error and
        // nothing in the UI to suggest anything had gone. Comparing the whole set catches
        // a row added elsewhere and one deleted elsewhere alike.
        const current = await tx.announcement.findMany({
          select: { id: true, endsAt: true },
        });
        const currentIds = new Set(current.map((a) => a.id));
        const knownIds = new Set(input.knownIds);

        const unchanged =
          currentIds.size === knownIds.size &&
          [...currentIds].every((id) => knownIds.has(id)) &&
          // An id the list does not hold - a row deleted since, or one this form never
          // loaded - would otherwise reach `update` and fail there as a 500.
          keep.every((id) => currentIds.has(id));

        if (!unchanged) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Someone else changed the announcements while this page was open. Reload and make your change again.",
          });
        }

        // A row sent with no end keeps the stored one (a tab from before end dates), so the
        // schema's check that the end is not before the date cannot see it. Moving the date
        // past that end would save an announcement that never shows, with nothing said.
        const storedEnds = new Map(current.map((a) => [a.id, a.endsAt]));
        const endsBeforeItsDate = input.announcements.some((a) => {
          const storedEnd = a.id && a.endsOn === undefined && storedEnds.get(a.id);
          return storedEnd ? storedEnd < startOfDayNZ(a.publishedOn) : false;
        });
        if (endsBeforeItsDate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "An announcement now ends before the date you gave it. Reload the page to see its end date, then save again.",
          });
        }

        // Anything the admin removed from the list. Deleting is safe here in a way it is
        // not for an offer: nothing references an announcement, so there is no history to
        // take with it.
        await tx.announcement.deleteMany({
          where: keep.length ? { id: { notIn: keep } } : {},
        });

        for (const [position, a] of input.announcements.entries()) {
          const data = {
            title: a.title,
            text1: a.text1,
            text2: a.text2?.length ? a.text2 : null,
            isActive: a.isActive,
            position,
            publishedAt: startOfDayNZ(a.publishedOn),
            // The last instant of the day, as an offer's end is, so it shows through it.
            // Left out when the form sent no end at all (a tab from before end dates), so
            // an update keeps the stored one rather than clearing it.
            ...(a.endsOn === undefined
              ? {}
              : { endsAt: a.endsOn === null ? null : endOfDayNZ(a.endsOn) }),
          };

          if (a.id) {
            await tx.announcement.update({ where: { id: a.id }, data });
          } else {
            await tx.announcement.create({ data });
          }
        }
      });

      return { saved: input.announcements.length };
    }),

  /**
   * Whether anything here is out of step with what it describes. The benefits are free
   * text, so nothing can stop an admin writing "2x loyalty points" over a 1.5x rate - which
   * is exactly what was live for months - but the screen can say so while they type.
   */
  getSettingsWarnings: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      const [rates, plan] = await Promise.all([
        ctx.db.loyaltySetting.findFirst({
          select: { memberBonusPercent: true, pointsExpireFrom: true },
        }),
        ctx.db.membershipPlan.findFirst({
          where: { name: "Monthly_Membership" },
          select: { benefits: true },
        }),
      ]);

      const memberMultiplier = (rates?.memberBonusPercent ?? 150) / 100;

      // The saved rows, for the state the screen opens in. The card re-runs the same
      // detector against what is currently typed, so a mismatch is shown before it is
      // published rather than after - which was the whole point of the warning.
      return {
        memberMultiplier,
        // Whether a benefit marked {{whilePointsExpire}} is currently shown to customers.
        pointsExpire: Boolean(rates?.pointsExpireFrom),
        claimsOtherMultiplier: benefitsClaimingOtherMultiplier(
          plan?.benefits ?? [],
          memberMultiplier,
        ),
      };
    }),

  /** The days off still to come, as Auckland days ("2026-12-25"). */
  getDaysOff: protectedProcedure.query(({ ctx }) => upcomingDaysOff(ctx.db)),

  /**
   * Closes and reopens days, and answers with the days off as they now are.
   *
   * Written here directly, as the other settings are, rather than through the order
   * server's `updateDaysOff`. Nothing about a day off needs a guard only that server holds,
   * and the moment it matters, it sees the change at once: its order checks read the table
   * uncached (`getDaysOffKeys`), so an order for a day closed here is refused as soon as this
   * commits. Only its public `/api/getDaysOff`, which the apps draw their calendars from, is
   * cached - five minutes in Redis, which a writer here cannot clear - so the customer app
   * goes on offering the day for a few minutes, and the order server refuses it at checkout,
   * before the card is touched.
   *
   * A day matches the rows on its Auckland date however each was stored, as the order
   * server matches them: a day already off is not written again, and reopening one deletes
   * every row on it.
   */
  saveDaysOff: protectedProcedure
    .input(saveDaysOffSchema)
    .mutation(async ({ ctx, input }) => {
      const today = todayNZ();
      // Today is allowed - a closure decided in the morning - but a day that has gone
      // cannot be closed. Only a page left open past midnight sends one.
      const passed = input.added.filter((day) => day < today);
      if (passed.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${passed.map((day) => formatDayOff(day, "en")).join(" and ")} ${passed.length === 1 ? "has" : "have"} already passed. Reload the page and pick your days again.`,
        });
      }

      await ctx.db.$transaction(async (tx) => {
        await lockDaysOff(tx);

        const rows = await tx.daysOff.findMany({
          select: { id: true, date: true },
        });
        const onFile = new Set(rows.map((row) => nzDayKey(row.date)));
        const reopening = new Set(input.removed);

        const toAdd = [...new Set(input.added)].filter(
          (day) => !onFile.has(day),
        );
        const toDelete = rows
          .filter((row) => reopening.has(nzDayKey(row.date)))
          .map((row) => row.id);

        if (toAdd.length > 0) {
          await tx.daysOff.createMany({
            // Auckland midnight, as the staff app stores a day off and this site's checkout
            // bounds its read on. The server runs in UTC, where midnight is 12-13 hours on.
            data: toAdd.map((day) => ({ date: startOfDayNZ(day) })),
          });
        }
        if (toDelete.length > 0) {
          await tx.daysOff.deleteMany({ where: { id: { in: toDelete } } });
        }
      });

      // This site's checkout caches its days off for five minutes; without this it would
      // go on offering a day just closed.
      revalidateTag(DAYS_OFF_TAG);

      return upcomingDaysOff(ctx.db);
    }),

  /**
   * The orders still to be collected on the given Auckland days, earliest first, so the
   * screen can say who is booked on a day before it is closed. Closing a day cancels
   * nothing and tells nobody: staff contact the customer, and cancel from the staff app if
   * it comes to that.
   *
   * Real names and phone numbers, as the other admin screens show them: staff are the ones
   * who have to ring.
   */
  getOrdersBookedOn: protectedProcedure
    .input(z.object({ days: z.array(z.string().date()).max(366) }))
    .query(async ({ ctx, input }) => {
      const days = [...new Set(input.days)];
      if (days.length === 0) return [];

      const orders = await ctx.db.order.findMany({
        where: {
          status: { in: [...OPEN_ORDER_STATUSES] },
          OR: days.map((day) => ({
            pickUpTime: { gte: startOfDayNZ(day), lte: endOfDayNZ(day) },
          })),
        },
        select: {
          id: true,
          pickUpTime: true,
          customerFirstName: true,
          customerLastName: true,
          customerPhoneNumber: true,
          source: true,
          status: true,
        },
        orderBy: { pickUpTime: "asc" },
      });

      return orders.map(
        ({ customerFirstName, customerLastName, ...order }) => ({
          ...order,
          day: nzDayKey(order.pickUpTime),
          customerName: `${customerFirstName} ${customerLastName}`.trim(),
        }),
      );
    }),
});
