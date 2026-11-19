import { timeOfDay } from "./openToday";
import {
  LAST_PICK_UP_OFFSET_MINUTES,
  nzDayKey,
  nzMinuteOfDay,
  type DayHours,
} from "./pickUpTimes";

/**
 * What the checkout says about a pick-up time: the estimate, the day strip, the hours
 * line and the order summary's line.
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
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** A day key's month, day of the month and weekday, with no clock involved. */
const partsOf = (dayKey: string) => {
  const [year, month, day] = dayKey.split("-").map(Number);
  return {
    month: month!,
    day: day!,
    weekday: new Date(Date.UTC(year!, month! - 1, day)).getUTCDay(),
  };
};

/** "Fri 20 Nov" or "11月20日（周五）". */
export const dayLabel = (dayKey: string, language: Language): string => {
  const { month, day, weekday } = partsOf(dayKey);
  return language === "en"
    ? `${EN_WEEKDAYS[weekday]!.slice(0, 3)} ${day} ${EN_MONTHS[month - 1]}`
    : `${month}月${day}日（${ZH_WEEKDAYS[weekday]}）`;
};

/** "Fri 20 Nov, 6:42 pm" or "11月20日（周五）6:42 PM", on the Auckland clock. */
export const pickUpTimeLabel = (time: Date, language: Language): string => {
  const day = dayLabel(nzDayKey(time), language);
  const clock = timeOfDay(nzMinuteOfDay(time), language);
  return language === "en" ? `${day}, ${clock}` : `${day}${clock}`;
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
