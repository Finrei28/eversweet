import { TRPCError } from "@trpc/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import {
  loyaltyRatesSchema,
  pointsExpirySchema,
  membershipBenefitsSchema,
  saveAnnouncementsSchema,
  shopProfileSchema,
} from "~/app/components/schemas";
import { calendarDate, startOfDayNZ } from "~/lib/aucklandDay";
import { benefitsClaimingOtherMultiplier } from "~/lib/shopSettings";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
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
      }
    );
  }),

  saveShopProfile: protectedProcedure
    .input(shopProfileSchema)
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.db.shopProfile.updateMany({ data: input });
      if (count === 0) {
        await ctx.db.shopProfile.create({
          data: { id: SINGLETON_ID, ...input },
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
      },
    });

    // The stored instant back to the calendar day it falls on in Auckland, so the picker
    // shows the day that was chosen rather than the browser's reading of the instant.
    return rows.map((row) => ({
      ...row,
      publishedAt: calendarDate(row.publishedAt),
    }));
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
        // Refuse a submission built from a list that has since changed. Saving replaces
        // the whole collection, so without this an admin whose form loaded before someone
        // else added an announcement would delete it on save - silently, with no error and
        // nothing in the UI to suggest anything had gone. Comparing the whole set catches
        // a row added elsewhere and one deleted elsewhere alike.
        const current = await tx.announcement.findMany({
          select: { id: true },
        });
        const currentIds = new Set(current.map((a) => a.id));
        const knownIds = new Set(input.knownIds);

        const unchanged =
          currentIds.size === knownIds.size &&
          [...currentIds].every((id) => knownIds.has(id));

        if (!unchanged) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Someone else changed the announcements while this page was open. Reload and make your change again.",
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
});
