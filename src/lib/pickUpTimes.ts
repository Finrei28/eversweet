import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { Locale } from "date-fns";

/**
 * When a website order can be picked up.
 *
 * The rule, which the order server's `lib/tradingHours.ts` and the customer app's
 * `lib/checkoutHelpers.ts` implement too, and which all three prove against the same
 * `pickUpTimeCases.json`:
 *
 * - Every calendar day and time of day is read on the Pacific/Auckland wall clock (NZST
 *   or NZDT, whichever is in force), never the device's or the server's. Vercel runs in
 *   UTC, and a customer's phone can be set anywhere.
 * - The weekly hours are the `TradingHours` table; one-off closures are `DaysOff`,
 *   matched by Auckland calendar day.
 * - The last pick-up is 10 minutes before closing, so a late customer still leaves the
 *   shop time to close on time. A 9:30 PM close takes pick-ups up to 9:20 PM.
 * - ASAP is the later of now plus the kitchen's quote (rounded up to the whole minute)
 *   and opening, if that is no later than the last pick-up. Otherwise it is the next
 *   trading day's opening time.
 *
 * Everything here takes `now` rather than reading the clock, so it can be tested at any
 * instant. This replaced `pickUpTimeHelper.ts`, which read hours off the device clock and
 * compared whole hours against fractional closing times (21 against 21.5), so from 9:15 PM
 * it offered pick-ups after the shop had shut.
 */

export const NZ_TIMEZONE = "Pacific/Auckland";

/** The last pick-up is this long before closing. Mirrored by the order server. */
export const LAST_PICK_UP_OFFSET_MINUTES = 10;

/** The customer picker offers times on these marks. ASAP need not fall on one. */
export const SLOT_MINUTES = 10;

/** How far ahead to look for a trading day before deciding the shop is shut. */
const MAX_DAYS_AHEAD = 60;

/** Minutes past Auckland midnight. */
export type DayHours = { opensAt: number; closesAt: number };

/** Indexed by weekday, 0 = Sunday. A null day is closed. */
export type WeeklyHours = readonly (DayHours | null)[];

export type TradingCalendar = {
  hours: WeeklyHours;
  /** Auckland calendar days the shop is shut, as "yyyy-MM-dd". */
  daysOff: ReadonlySet<string>;
};

export type PickUpProblem =
  | "invalid-date"
  | "closed-day"
  | "before-open"
  | "after-last-pick-up";

const isValidDate = (date: Date) =>
  date instanceof Date && !Number.isNaN(date.getTime());

/**
 * The Auckland calendar and clock at `date`, read straight from `Intl`.
 *
 * Not `formatInTimeZone`: it builds a Date whose *device-local* fields spell the Auckland
 * time, and an Auckland time that does not exist on the device's own clock - inside its
 * daylight saving gap - comes back an hour out. In a browser in Los Angeles, 2:30 AM
 * Auckland time on 8 March 2026 read as 3:30. `Intl` with a `timeZone` never passes
 * through the device's zone. (Display formatting still uses `formatNZ`, where an hour out
 * at 2 AM on one night a year cannot reach a pick-up time.)
 */
const nzPartsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: NZ_TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const nzParts = (date: Date) => {
  const parts: Record<string, string> = {};
  for (const part of nzPartsFormat.formatToParts(date)) {
    parts[part.type] = part.value;
  }
  return {
    dayKey: `${parts.year}-${parts.month}-${parts.day}`,
    // Some engines write midnight as 24 even in a 23-hour cycle.
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
  };
};

/** The Auckland calendar day at `date`, as "yyyy-MM-dd". */
export const nzDayKey = (date: Date): string => nzParts(date).dayKey;

/** Minutes past Auckland midnight at `date`, ignoring seconds. */
export const nzMinuteOfDay = (date: Date): number => nzParts(date).minutes;

/** The weekday of a calendar day, 0 = Sunday. A calendar day has no timezone. */
const weekdayOf = (dayKey: string): number => {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day)).getUTCDay();
};

/** The calendar day `days` after `dayKey`. */
export const addDaysToKey = (dayKey: string, days: number): string => {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days))
    .toISOString()
    .slice(0, 10);
};

/**
 * The instant `minutes` past midnight on an Auckland calendar day. `fromZonedTime`
 * resolves the offset for that day, so a day either side of a daylight saving change
 * lands on the right instant.
 */
export const atNZ = (dayKey: string, minutes: number): Date => {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return fromZonedTime(`${dayKey}T${hh}:${mm}:00`, NZ_TIMEZONE);
};

/** A day's hours in minutes, or null when it is closed or a day off. */
export const hoursOn = (
  dayKey: string,
  { hours, daysOff }: TradingCalendar,
): DayHours | null =>
  daysOff.has(dayKey) ? null : (hours[weekdayOf(dayKey)] ?? null);

/** A day's hours as instants, or null when the shop does not trade that day. */
export const tradingWindow = (
  dayKey: string,
  calendar: TradingCalendar,
): { opensAt: Date; closesAt: Date; lastPickUp: Date } | null => {
  const day = hoursOn(dayKey, calendar);
  if (!day) return null;

  return {
    opensAt: atNZ(dayKey, day.opensAt),
    closesAt: atNZ(dayKey, day.closesAt),
    lastPickUp: atNZ(dayKey, day.closesAt - LAST_PICK_UP_OFFSET_MINUTES),
  };
};

/** The soonest the kitchen can have an order ready, rounded up to the whole minute. */
export const earliestReadyAt = (now: Date, quoteMinutes: number): Date => {
  const minute = 60 * 1000;
  return new Date(
    Math.ceil((now.getTime() + quoteMinutes * minute) / minute) * minute,
  );
};

/**
 * What is wrong with `when` as a pick-up time on the shop's hours, or null when nothing
 * is. Compared to the minute, so any second of the last pick-up minute is still in time.
 *
 * Whether the kitchen can have it ready by then is a separate question: see `isTooSoon`.
 */
export const pickUpProblem = (
  when: Date,
  calendar: TradingCalendar,
): PickUpProblem | null => {
  if (!isValidDate(when)) return "invalid-date";

  const day = hoursOn(nzDayKey(when), calendar);
  if (!day) return "closed-day";

  const minute = nzMinuteOfDay(when);
  if (minute < day.opensAt) return "before-open";
  if (minute > day.closesAt - LAST_PICK_UP_OFFSET_MINUTES) {
    return "after-last-pick-up";
  }
  return null;
};

/**
 * Whether `when` is sooner than the kitchen can have the order ready. An unusable date
 * counts as too soon, so a caller replaces it rather than keeping it.
 *
 * The quote depends on the size of the order, so a time that suited two desserts can be
 * too soon once a fourth is added: callers pass the quote for the cart as it is now.
 */
export const isTooSoon = (
  when: Date,
  now: Date,
  quoteMinutes: number,
  graceMinutes = 0,
): boolean =>
  !isValidDate(when) ||
  when.getTime() <
    earliestReadyAt(now, quoteMinutes).getTime() - graceMinutes * 60 * 1000;

/** The opening time of the first trading day on or after `fromDayKey`. */
export const nextOpening = (
  fromDayKey: string,
  calendar: TradingCalendar,
): Date | null => {
  for (let offset = 0; offset < MAX_DAYS_AHEAD; offset++) {
    const window = tradingWindow(addDaysToKey(fromDayKey, offset), calendar);
    if (window) return window.opensAt;
  }
  return null;
};

/**
 * The soonest pick-up: now plus the quote, or opening if later, as long as that is no
 * later than the last pick-up. Otherwise the next trading day's opening. Null only when
 * the shop has no trading day in the next 60.
 */
export const asapPickUpTime = (
  now: Date,
  quoteMinutes: number,
  calendar: TradingCalendar,
): Date | null => {
  const earliest = earliestReadyAt(now, quoteMinutes);
  const dayKey = nzDayKey(earliest);
  const today = tradingWindow(dayKey, calendar);

  if (today) {
    const candidate =
      earliest.getTime() > today.opensAt.getTime() ? earliest : today.opensAt;
    if (candidate.getTime() <= today.lastPickUp.getTime()) return candidate;
  }

  return nextOpening(addDaysToKey(dayKey, 1), calendar);
};

/**
 * The times the picker offers on a day: every `SLOT_MINUTES` mark from opening to the
 * last pick-up, leaving out any the kitchen cannot have ready in time. Empty on a closed
 * day, and on today once its last pick-up has gone.
 */
export const pickUpSlots = (
  dayKey: string,
  now: Date,
  quoteMinutes: number,
  calendar: TradingCalendar,
): Date[] => {
  const day = hoursOn(dayKey, calendar);
  if (!day) return [];

  const earliest = earliestReadyAt(now, quoteMinutes).getTime();
  const last = day.closesAt - LAST_PICK_UP_OFFSET_MINUTES;
  const slots: Date[] = [];

  for (
    let minute = Math.ceil(day.opensAt / SLOT_MINUTES) * SLOT_MINUTES;
    minute <= last;
    minute += SLOT_MINUTES
  ) {
    const slot = atNZ(dayKey, minute);
    if (slot.getTime() >= earliest) slots.push(slot);
  }

  return slots;
};

/** The first day on or after `fromDayKey` that still has a slot to offer. */
export const nextDayWithSlots = (
  fromDayKey: string,
  now: Date,
  quoteMinutes: number,
  calendar: TradingCalendar,
): string | null => {
  for (let offset = 0; offset < MAX_DAYS_AHEAD; offset++) {
    const dayKey = addDaysToKey(fromDayKey, offset);
    if (pickUpSlots(dayKey, now, quoteMinutes, calendar).length > 0) {
      return dayKey;
    }
  }
  return null;
};

/** Formats `date` on the Auckland clock, whatever the device or server is set to. */
export const formatNZ = (
  date: Date,
  pattern: string,
  options?: { locale?: Locale },
): string => formatInTimeZone(date, NZ_TIMEZONE, pattern, options);

/** "h:mm a" for a day's minutes, e.g. 1290 is "9:30 PM". */
export const formatMinutes = (minutes: number): string => {
  const hours24 = Math.floor(minutes / 60);
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes % 60).padStart(2, "0")} ${
    hours24 >= 12 && hours24 < 24 ? "PM" : "AM"
  }`;
};

/** The shape the order server's `/api/getStoreHours` and the database rows share. */
export type TradingHoursRow = {
  weekday: number;
  opensAt: number | null;
  closesAt: number | null;
};

/** The table's rows as `WeeklyHours`. A weekday with no row reads as closed. */
export const toWeeklyHours = (rows: readonly TradingHoursRow[]): WeeklyHours =>
  Array.from({ length: 7 }, (_, weekday) => {
    const row = rows.find((r) => r.weekday === weekday);
    return row && row.opensAt !== null && row.closesAt !== null
      ? { opensAt: row.opensAt, closesAt: row.closesAt }
      : null;
  });

/** Days off as Auckland calendar-day keys. The admin app stores each as that day's midnight. */
export const toDaysOffKeys = (dates: readonly Date[]): Set<string> =>
  new Set(dates.map(nzDayKey));
