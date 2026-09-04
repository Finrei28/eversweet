import { unstable_cache } from "next/cache";
import { DateTime } from "luxon";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";

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

export const storeRouter = createTRPCRouter({
  getDaysOff: publicProcedure.query(async () => {
    const today = DateTime.now()
      .setZone("Pacific/Auckland")
      .startOf("day")
      .toJSDate();
    const dates = await getDaysOffCached(today.toISOString());
    return dates.map((iso) => new Date(iso));
  }),
});
