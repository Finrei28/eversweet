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

export const storeRouter = createTRPCRouter({
  getPrepTimes: publicProcedure.query((): Promise<PrepTimes> => getPrepTimes()),

  getDaysOff: publicProcedure.query(() => getDaysOff()),

  /** The weekly hours, one row per weekday, in minutes past Auckland midnight. */
  getTradingHours: publicProcedure.query(
    (): Promise<TradingHoursRow[]> => getTradingHours(),
  ),

  /**
   * The check a pick-up time must pass before the customer pays. A mutation rather than a
   * query only so React Query never answers it from cache: the same time and cart can be
   * fine at 9:10 PM and too late at 9:21.
   */
  checkPickUpTime: publicProcedure
    .input(
      z.object({
        pickUpTime: z.date(),
        itemCount: z.number().int().positive(),
      }),
    )
    .mutation(({ input }) =>
      checkWebsitePickUpTime(input.pickUpTime, input.itemCount),
    ),
});
