import { DateTime } from "luxon";

/**
 * Dates for the monthly prize a winner collects in store.
 *
 * Every boundary here is an Auckland one. The server runs in UTC, so anything computed
 * with plain `Date` arithmetic lands 12-13 hours early depending on the time of year.
 */

const ZONE = "Pacific/Auckland";

/**
 * The default deadline for a prize: the end of the month AFTER the month that was won.
 *
 * Derived from the won month rather than from today, so assigning a prize three weeks
 * late does not hand the winner three extra weeks - a September win expires on 31
 * October whether it was assigned on the 1st or the 28th.
 *
 * luxon carries the year, so month 12 plus one month is January of the next year, and
 * `endOf("month")` knows which February is 29 days long.
 */
export const defaultRewardExpiry = (month: number, year: number): Date =>
  DateTime.fromObject({ year, month, day: 1 }, { zone: ZONE })
    .plus({ months: 1 })
    .endOf("month")
    .toJSDate();

/**
 * The day an admin clicked in the calendar, as the date they saw: "2026-10-31".
 *
 * **Call it in the browser.** The calendar hands back midnight in the browser's own
 * timezone, and this reads the date in whatever zone it runs in. On the server, which runs
 * in UTC, a click on 31 October in Auckland is still 30 October.
 */
export const pickedDay = (date: Date): string =>
  DateTime.fromJSDate(date).toFormat("yyyy-LL-dd");

/**
 * An admin's chosen expiry, pinned to the last instant of that day in Auckland.
 *
 * Takes the day as a string, so the host's timezone cannot move it. It used to take the
 * calendar's `Date` and read the day off it with `keepLocalTime` on the server. That
 * passed every test on a machine in Auckland, and on Vercel it made every chosen expiry a
 * day early: the prize died at the end of the 30th for a customer told the 31st.
 *
 * The last instant rather than the first, so the code is valid *through* the day.
 */
export const endOfDayNZ = (day: string): Date =>
  DateTime.fromISO(day, { zone: ZONE }).endOf("day").toJSDate();

/**
 * How a prize code is shown: two groups of four, the way the order server returns it and
 * the customer's app displays it. Codes are stored bare, and the counter accepts either.
 */
export const formatPrizeCode = (code: string): string =>
  `${code.slice(0, 4)}-${code.slice(4)}`;

export type RewardStatus =
  | "UNASSIGNED"
  | "ASSIGNED"
  | "REDEEMED"
  | "EXPIRED";

/**
 * Redeemed beats expired: a prize collected on its last day was still collected, and
 * the row should not start reading "expired" the next morning.
 */
export const rewardStatus = (
  reward: { expiresAt: Date; redeemedAt: Date | null } | null | undefined,
  now: Date = new Date(),
): RewardStatus => {
  if (!reward) return "UNASSIGNED";
  if (reward.redeemedAt) return "REDEEMED";
  return reward.expiresAt < now ? "EXPIRED" : "ASSIGNED";
};

/** "September 2026" / "2026年9月" */
export const monthLabel = (
  month: number,
  year: number,
  language: "en" | "zh",
): string =>
  language === "en"
    ? DateTime.fromObject({ year, month }, { zone: ZONE }).toFormat("LLLL yyyy")
    : `${year}年${month}月`;

/**
 * The most recent finished months on the Auckland calendar, newest first: the months a
 * missed settle could be for.
 *
 * Starts at last month, never this one, so the "settle a missed month" dialog cannot offer
 * the month still being competed for. Settling that early would freeze a podium with weeks
 * of points still to come, and it could never be revisited.
 */
export const finishedMonths = (
  count = 12,
  now: Date = new Date(),
): { month: number; year: number }[] => {
  const thisMonth = DateTime.fromJSDate(now).setZone(ZONE).startOf("month");

  return Array.from({ length: count }, (_, index) => {
    const month = thisMonth.minus({ months: index + 1 });
    return { month: month.month, year: month.year };
  });
};
