import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import type { PrepTimes } from "~/lib/prepTimes";
import type { TradingHoursRow } from "~/lib/pickUpTimes";
import {
  checkWebsitePickUpTime,
  getDaysOff,
  getPrepTimes,
  getTradingHours,
} from "~/server/pickUpTimes";
import type { AppOffer } from "~/lib/appOffer";
import { getAppOffer } from "~/server/appOffer";
import { type AppPromotion, getAppPromotion } from "~/server/appPromotion";
import { itemCountForPayment } from "~/server/paymentItemCount";

export const storeRouter = createTRPCRouter({
  getPrepTimes: publicProcedure.query((): Promise<PrepTimes> => getPrepTimes()),

  getDaysOff: publicProcedure.query(() => getDaysOff()),

  /**
   * What the website's app promotions may say about the customer app: whether points are
   * earned, whether members earn more, and whether the leaderboard is shown. Never throws.
   */
  getAppPromotion: publicProcedure.query(
    (): Promise<AppPromotion> => getAppPromotion(),
  ),

  /**
   * The customer app's sago offer while it is running, for the pop-up that sends visitors
   * to the app; null otherwise, or on a failed read. Advertised only: nothing on this
   * website prices against an offer.
   */
  getAppOffer: publicProcedure.query(
    (): Promise<AppOffer | null> => getAppOffer(),
  ),

  /** The weekly hours, one row per weekday, in minutes past Auckland midnight. */
  getTradingHours: publicProcedure.query(
    (): Promise<TradingHoursRow[]> => getTradingHours(),
  ),

  /**
   * The check a pick-up time must pass before the customer pays. A mutation rather than a
   * query only so React Query never answers it from cache: the same time and cart can be
   * fine at 9:10 PM and too late at 9:21.
   *
   * Takes the payment rather than an item count: the size of the order, which decides how
   * long the kitchen is given, is read from what the server recorded when it priced the
   * cart for that payment, never from the browser.
   */
  checkPickUpTime: publicProcedure
    .input(
      z.object({
        pickUpTime: z.date(),
        paymentIntentId: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) =>
      checkWebsitePickUpTime(
        input.pickUpTime,
        await itemCountForPayment(input.paymentIntentId),
      ),
    ),
});
