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
 * An admin's override, pinned to the last instant of the day they picked.
 *
 * The calendar hands back midnight in the *browser's* timezone. Taken at face value
 * that is a code which dies at the start of the chosen day, and for an admin travelling
 * it is the wrong day entirely. `keepLocalTime` reads the clock-face date they clicked
 * and re-anchors it in Auckland - the same move pickUpTimeHelper makes, for the same
 * reason. Applied on the server, so the expiry the mobile app enforces does not depend
 * on which device assigned it.
 */
export const endOfDayNZ = (date: Date): Date =>
  DateTime.fromJSDate(date)
    .setZone(ZONE, { keepLocalTime: true })
    .endOf("day")
    .toJSDate();

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
