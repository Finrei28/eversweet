import { describe, expect, it } from "vitest";

import { openToday, timeOfDay } from "./openToday";
import { atNZ, toDaysOffKeys, toWeeklyHours } from "./pickUpTimes";

/**
 * The home page's "Open today until 10:00 pm" line, worked out from the same trading
 * hours and days off checkout uses, in Auckland time whatever the browser's zone.
 */
const hours = toWeeklyHours([
  { weekday: 1, opensAt: 750, closesAt: 1290 }, // Monday 12:30 pm - 9:30 pm
  { weekday: 3, opensAt: null, closesAt: null }, // closed Wednesdays
  { weekday: 5, opensAt: 720, closesAt: 1320 }, // Friday 12:00 pm - 10:00 pm
]);
const calendar = (daysOff: Date[] = []) => ({
  hours,
  daysOff: toDaysOffKeys(daysOff),
});

// 20 November 2026 is a Friday, 23 November a Monday, 25 November a Wednesday.
const FRIDAY = "2026-11-20";

describe("openToday", () => {
  it("is open until closing while the shop is trading", () => {
    expect(openToday(atNZ(FRIDAY, 15 * 60), calendar())).toEqual({
      state: "open",
      until: 1320,
    });
  });

  it("is still open the minute before closing", () => {
    expect(openToday(atNZ(FRIDAY, 1319), calendar())).toEqual({
      state: "open",
      until: 1320,
    });
  });

  it("opens later on a trading day before opening time", () => {
    expect(openToday(atNZ(FRIDAY, 11 * 60), calendar())).toEqual({
      state: "opens-later",
      at: 720,
    });
  });

  it("is closed from the closing minute on", () => {
    expect(openToday(atNZ(FRIDAY, 1320), calendar())).toEqual({
      state: "closed",
    });
  });

  it("is closed on a weekday the shop does not trade", () => {
    expect(openToday(atNZ("2026-11-25", 15 * 60), calendar())).toEqual({
      state: "closed",
    });
  });

  it("is closed on a day off, which is stored as Auckland midnight", () => {
    expect(
      openToday(atNZ(FRIDAY, 15 * 60), calendar([atNZ(FRIDAY, 0)])),
    ).toEqual({ state: "closed" });
  });

  it("reads the day in Auckland, not UTC", () => {
    // 11:45 pm UTC on Sunday 22 November is 12:45 pm Monday in Auckland (NZDT, +13).
    expect(openToday(new Date("2026-11-22T23:45:00Z"), calendar())).toEqual({
      state: "open",
      until: 1290,
    });
  });
});

describe("timeOfDay", () => {
  it("writes English times in lower case and Chinese ones as before", () => {
    expect(timeOfDay(1320, "en")).toBe("10:00 pm");
    expect(timeOfDay(750, "en")).toBe("12:30 pm");
    expect(timeOfDay(1320, "zh")).toBe("10:00 PM");
  });
});
