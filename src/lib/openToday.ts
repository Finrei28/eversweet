import {
  formatMinutes,
  hoursOn,
  nzDayKey,
  nzMinuteOfDay,
  type TradingCalendar,
} from "./pickUpTimes";

/** Where the shop stands today, in minutes past Auckland midnight. */
export type OpenToday =
  | { state: "open"; until: number }
  | { state: "opens-later"; at: number }
  | { state: "closed" };

/**
 * The home page's "Open today until 10:00 pm", from the same weekly hours and days off
 * checkout reads, so the two never disagree about whether the shop is trading. A day
 * off or a closed weekday is closed all day; so is the rest of the day after closing.
 */
export function openToday(now: Date, calendar: TradingCalendar): OpenToday {
  const day = hoursOn(nzDayKey(now), calendar);
  if (!day) return { state: "closed" };

  const minute = nzMinuteOfDay(now);
  if (minute < day.opensAt) return { state: "opens-later", at: day.opensAt };
  if (minute < day.closesAt) return { state: "open", until: day.closesAt };
  return { state: "closed" };
}

/**
 * A time of day as the redesigned pages write it: "10:00 pm" in English, as the
 * mock-ups have it, and "10:00 PM" in Chinese, as the site wrote it before.
 */
export const timeOfDay = (minutes: number, language: "en" | "zh"): string =>
  language === "en"
    ? formatMinutes(minutes).toLowerCase()
    : formatMinutes(minutes);
