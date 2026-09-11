import { unstable_cache } from "next/cache";
import { DateTime } from "luxon";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { DEFAULT_PREP_TIMES, type PrepTimes } from "~/lib/prepTimes";

/**
 * Read on every customer-facing page load, changes a few times a year.
 *
 * The NZ date is passed as an argument rather than read inside the cached
 * function so it forms part of the cache key - otherwise a cached result would
 * survive past the day boundary it was computed for.
 *
 * ISO strings cross the cache boundary because the Next.js data cache does not
 * preserve `Date` instances, and the client feeds these straight into
 * date-fns `format()`, which rejects strings.
 */
const getDaysOffCached = unstable_cache(
  async (todayIso: string) => {
    const daysOff = await db.daysOff.findMany({
      select: { date: true },
      where: { date: { gte: new Date(todayIso) } },
      orderBy: { date: "asc" },
    });
    return daysOff.map((day) => day.date.toISOString());
  },
  ["days-off"],
  { revalidate: 300, tags: ["days-off"] },
);

/**
 * One row, read on every checkout, changed rarely. Cached like the days off,
 * and falling back to the defaults rather than throwing: an unreadable
 * settings row must not stop a customer being offered a pick-up time.
 */
const getPrepTimesCached = unstable_cache(
  async (): Promise<PrepTimes> => {
    const row = await db.prepTimeSetting.findFirst();

    if (!row) return DEFAULT_PREP_TIMES;

    return {
      singleItem: row.singleItem,
      upToThree: row.upToThree,
      upToSix: row.upToSix,
      moreThanSix: row.moreThanSix,
      kitchenSlack: row.kitchenSlack,
      quoteFloor: row.quoteFloor,
    };
  },
  ["prep-times"],
  { revalidate: 300, tags: ["prep-times"] },
);

export const storeRouter = createTRPCRouter({
  getPrepTimes: publicProcedure.query(async (): Promise<PrepTimes> => {
    try {
      return await getPrepTimesCached();
    } catch (error) {
      console.error("Could not read preparation times:", error);
      return DEFAULT_PREP_TIMES;
    }
  }),

  getDaysOff: publicProcedure.query(async () => {
    const today = DateTime.now()
      .setZone("Pacific/Auckland")
      .startOf("day")
      .toJSDate();
    const dates = await getDaysOffCached(today.toISOString());
    return dates.map((iso) => new Date(iso));
  }),
});
