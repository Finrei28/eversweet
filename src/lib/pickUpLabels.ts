import { timeOfDay } from "./openToday";
import {
  addDaysToKey,
  LAST_PICK_UP_OFFSET_MINUTES,
  nzDayKey,
  nzMinuteOfDay,
  toDaysOffKeys,
  type DayHours,
} from "./pickUpTimes";

/**
 * What the checkout says about a pick-up time: the estimate, the day strip, the hours
 * line and the order summary's line. What the order page says about its two times, when
 * the order was placed and when to pick it up. And the days the shop will be closed, in
 * the notice the customer pages show.
 *
 * Built from Auckland day keys and minutes (`nzDayKey`, `nzMinuteOfDay`) and spelled out
 * here, never formatted from a `Date`, so the words cannot depend on the zone the browser
 * or the server runs in. Times are written as the home page's opening hours write them
 * (`timeOfDay`): "6:42 pm" in English, "6:42 PM" in Chinese.
 */
type Language = "en" | "zh";

const EN_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const ZH_WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const EN_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** A day key's year, month, day of the month and weekday, with no clock involved. */
const partsOf = (dayKey: string) => {
  const [year, month, day] = dayKey.split("-").map(Number);
  return {
    year: year!,
    month: month!,
    day: day!,
    weekday: new Date(Date.UTC(year!, month! - 1, day)).getUTCDay(),
  };
};

/** "Friday 20 November". */
const longDayLabel = (dayKey: string): string => {
  const { month, day, weekday } = partsOf(dayKey);
  return `${EN_WEEKDAYS[weekday]} ${day} ${EN_MONTHS[month - 1]}`;
};

/** "Fri 20 Nov" or "11月20日（周五）". */
export const dayLabel = (dayKey: string, language: Language): string => {
  const { month, day, weekday } = partsOf(dayKey);
  return language === "en"
    ? `${EN_WEEKDAYS[weekday]!.slice(0, 3)} ${day} ${EN_MONTHS[month - 1]!.slice(0, 3)}`
    : `${month}月${day}日（${ZH_WEEKDAYS[weekday]}）`;
};

/** "Fri 20 Nov, 6:42 pm" or "11月20日（周五）6:42 PM", on the Auckland clock. */
export const pickUpTimeLabel = (time: Date, language: Language): string => {
  const day = dayLabel(nzDayKey(time), language);
  const clock = timeOfDay(nzMinuteOfDay(time), language);
  return language === "en" ? `${day}, ${clock}` : `${day}${clock}`;
};

/**
 * The order page's pick-up time: "6:42 pm, Friday 20 November" as the mock-ups write it, or
 * "11月20日（周五）6:42 PM" as the checkout does.
 */
export const pickUpDateTimeLabel = (time: Date, language: Language): string => {
  if (language === "zh") return pickUpTimeLabel(time, language);
  return `${timeOfDay(nzMinuteOfDay(time), language)}, ${longDayLabel(nzDayKey(time))}`;
};

/** When an order was placed, with its year: "20 Nov 2026, 6:28 pm" or "2026年11月20日 6:28 PM". */
export const orderPlacedLabel = (time: Date, language: Language): string => {
  const { year, month, day } = partsOf(nzDayKey(time));
  const clock = timeOfDay(nzMinuteOfDay(time), language);
  return language === "en"
    ? `${day} ${EN_MONTHS[month - 1]!.slice(0, 3)} ${year}, ${clock}`
    : `${year}年${month}月${day}日 ${clock}`;
};

/** Days the shop is closed in a row, by their first and last Auckland day. */
export type Closure = { first: string; last: string };

/**
 * The days off the notice lists, as closures of days in a row. Each day off is stored as
 * Auckland midnight and is read by its Auckland day (`toDaysOffKeys`), never off the `Date`:
 * that midnight is the day before in UTC and anywhere west of it. Two rows on one day, which
 * a tablet and /admin/settings closing it together can write, count once.
 */
export const closures = (daysOff: readonly Date[]): Closure[] => {
  const result: Closure[] = [];
  for (const day of [...toDaysOffKeys(daysOff)].sort()) {
    const current = result[result.length - 1];
    if (current && addDaysToKey(current.last, 1) === day) current.last = day;
    else result.push({ first: day, last: day });
  }
  return result;
};

/**
 * How the notice names a closure: one day, "Tuesday 24 November" or "11月24日（周二）", or
 * days in a row by their first and last, which read with `joiner` between them. The days come
 * apart so each can be kept on one line; a narrow screen broke "（周日）" in two.
 */
export const closureLabel = (
  closure: Closure,
  language: Language,
): { days: string[]; joiner: string } => {
  const day = (key: string) =>
    language === "en" ? longDayLabel(key) : dayLabel(key, language);
  return {
    days:
      closure.first === closure.last
        ? [day(closure.first)]
        : [day(closure.first), day(closure.last)],
    joiner: language === "en" ? "\u00a0– " : "至",
  };
};

/** The order summary's line under its heading. An ASAP time is the kitchen's estimate. */
export const summaryPickUpLine = (
  time: Date,
  asap: boolean,
  language: Language,
): string => {
  const day = dayLabel(nzDayKey(time), language);
  const clock = timeOfDay(nzMinuteOfDay(time), language);
  return language === "en"
    ? `Pick up ${day}, ${asap ? "about " : ""}${clock}`
    : `取货时间：${day}${asap ? "约 " : ""}${clock}`;
};

/**
 * A day in the strip: its weekday ("Today" for today), its day of the month, and the
 * name a screen reader gives the button, which says when the day has nothing to pick.
 */
export const dayChip = (
  dayKey: string,
  todayKey: string,
  bookable: boolean,
  language: Language,
): { weekday: string; day: string; label: string } => {
  const en = language === "en";
  const { day, weekday } = partsOf(dayKey);
  const today = dayKey === todayKey;
  const name = today
    ? `${en ? "Today, " : "今天，"}${dayLabel(dayKey, language)}`
    : dayLabel(dayKey, language);
  return {
    weekday: today
      ? en
        ? "Today"
        : "今天"
      : en
        ? EN_WEEKDAYS[weekday]!.slice(0, 3)
        : ZH_WEEKDAYS[weekday]!,
    day: String(day),
    label: bookable
      ? name
      : `${name}${en ? ", no pick-up times" : "，无可取货时间"}`,
  };
};

/** "Hours: 12:00 pm – 10:00 pm. Last pick-up on Friday: 9:50 pm." */
export const hoursLine = (
  dayKey: string,
  hours: DayHours,
  language: Language,
): string => {
  const { weekday } = partsOf(dayKey);
  const opens = timeOfDay(hours.opensAt, language);
  const closes = timeOfDay(hours.closesAt, language);
  const last = timeOfDay(
    hours.closesAt - LAST_PICK_UP_OFFSET_MINUTES,
    language,
  );
  return language === "en"
    ? `Hours: ${opens} – ${closes}. Last pick-up on ${EN_WEEKDAYS[weekday]}: ${last}.`
    : `营业时间：${opens} – ${closes}。${ZH_WEEKDAYS[weekday]}最后取货时间：${last}。`;
};

/** How many times the grid shows before "Later times": four rows of three on a phone. */
export const SLOTS_SHOWN = 12;

/**
 * The times the grid shows: the first few, or all of them once "Later times" has been
 * pressed. Never fewer than reach the time already picked, so a picked time stays on
 * screen however it was chosen.
 */
export const visibleSlots = (
  slots: Date[],
  pickedTime: number | null,
  showAll: boolean,
): { shown: Date[]; more: boolean } => {
  if (showAll || slots.length <= SLOTS_SHOWN) {
    return { shown: slots, more: false };
  }
  const pickedIndex =
    pickedTime === null
      ? -1
      : slots.findIndex((slot) => slot.getTime() === pickedTime);
  const count = Math.max(SLOTS_SHOWN, pickedIndex + 1);
  return { shown: slots.slice(0, count), more: count < slots.length };
};
