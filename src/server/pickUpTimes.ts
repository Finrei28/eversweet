import "server-only";

import { unstable_cache } from "next/cache";

import { db } from "~/server/db";
import {
  DEFAULT_PREP_TIMES,
  quoteMinutes,
  type PrepTimes,
} from "~/lib/prepTimes";
import {
  asapPickUpTime,
  atNZ,
  isTooSoon,
  nzDayKey,
  pickUpProblem,
  toDaysOffKeys,
  toWeeklyHours,
  type PickUpProblem,
  type TradingCalendar,
  type TradingHoursRow,
} from "~/lib/pickUpTimes";

/**
 * The shop's calendar as the server reads it, and the check a website pick-up time has
 * to pass before the customer pays. The rule itself is `~/lib/pickUpTimes`.
 *
 * Each read is cached for five minutes. Days off and hours change a few times a year;
 * the cost of a stale read is a customer offered a time that has just stopped being
 * available, which the order server's own copy of the rule does not catch for website
 * orders, so the TTL is kept short rather than the tags left to do all the work.
 */

/**
 * The weekly hours. Unlike prep times there is no fallback: hours that cannot be read
 * leave nothing to offer, and a guessed copy is how five copies came to exist.
 */
const getTradingHoursCached = unstable_cache(
  async (): Promise<TradingHoursRow[]> =>
    db.tradingHours.findMany({
      select: { weekday: true, opensAt: true, closesAt: true },
      orderBy: { weekday: "asc" },
    }),
  ["trading-hours"],
  { revalidate: 300, tags: ["trading-hours"] },
);

/**
 * Days off from today onwards. The NZ date is an argument so it forms part of the cache
 * key; read inside, a cached result would survive past the day it was computed for.
 *
 * ISO strings cross the cache boundary because the Next data cache does not preserve
 * `Date` instances.
 */
const getDaysOffCached = unstable_cache(
  async (todayKey: string) => {
    const daysOff = await db.daysOff.findMany({
      select: { date: true },
      // Auckland midnight, which is how the admin app stores a day off. Midnight UTC on
      // the same date would be 12-13 hours later and drop today's own day off.
      where: { date: { gte: atNZ(todayKey, 0) } },
      orderBy: { date: "asc" },
    });
    return daysOff.map((day) => day.date.toISOString());
  },
  ["days-off"],
  { revalidate: 300, tags: ["days-off"] },
);

/**
 * One row, read on every checkout, changed rarely. Falls back to the defaults rather than
 * throwing: an unreadable settings row must not stop a customer being offered a time.
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

export const getTradingHours = (): Promise<TradingHoursRow[]> =>
  getTradingHoursCached();

export const getDaysOff = async (now: Date = new Date()): Promise<Date[]> =>
  (await getDaysOffCached(nzDayKey(now))).map((iso) => new Date(iso));

export const getPrepTimes = async (): Promise<PrepTimes> => {
  try {
    return await getPrepTimesCached();
  } catch (error) {
    console.error("Could not read preparation times:", error);
    return DEFAULT_PREP_TIMES;
  }
};

export const getTradingCalendar = async (
  now: Date = new Date(),
): Promise<TradingCalendar> => {
  const [rows, daysOff] = await Promise.all([
    getTradingHours(),
    getDaysOff(now),
  ]);
  return { hours: toWeeklyHours(rows), daysOff: toDaysOffKeys(daysOff) };
};

/**
 * How long a time may trail the kitchen's quote and still be accepted. The picker
 * refreshes every few seconds, but a customer can take a minute or two to fill in a card
 * after choosing ASAP; refusing them over that would only send them round again.
 */
export const PICK_UP_GRACE_MINUTES = 5;

/**
 * `serverNow` is the server's clock when it decided. The picker runs on the device's clock,
 * and a phone a few minutes slow would keep offering an ASAP the server keeps refusing - the
 * checkout uses this to correct the picker's clock, so the two agree on what "now" is.
 */
export type WebsitePickUpCheck =
  | { ok: true; serverNow: Date }
  | {
      ok: false;
      reason: PickUpProblem | "too-soon";
      /** The soonest time that would be accepted instead, for the customer to confirm. */
      asap: Date | null;
      serverNow: Date;
    };

/**
 * Whether a website order may be placed for `pickUpTime`, on the hours, days off and
 * preparation times in the database. The website's copy of the check the order server
 * applies to app orders; the browser runs the same rule, but only this one decides.
 *
 * `itemCount` null means the order's size is not known - a payment created before its count
 * was recorded, or one that cannot be read - and the order is given the quote for the largest
 * size of order. That can only make the time asked for later, never let one through early.
 */
export const checkWebsitePickUpTime = async (
  pickUpTime: Date,
  itemCount: number | null,
  now: Date = new Date(),
): Promise<WebsitePickUpCheck> => {
  const [calendar, prepTimes] = await Promise.all([
    getTradingCalendar(now),
    getPrepTimes(),
  ]);
  const quote = quoteMinutes(itemCount ?? Number.MAX_SAFE_INTEGER, prepTimes);

  const reason =
    pickUpProblem(pickUpTime, calendar) ??
    (isTooSoon(pickUpTime, now, quote, PICK_UP_GRACE_MINUTES)
      ? "too-soon"
      : null);

  return reason
    ? {
        ok: false,
        reason,
        asap: asapPickUpTime(now, quote, calendar),
        serverNow: now,
      }
    : { ok: true, serverNow: now };
};
