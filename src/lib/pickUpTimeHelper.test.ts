import { describe, expect, it } from "vitest";

import {
  getBusinessHoursForDate,
  getNextValidTime,
  getTimeSlots,
  isTooSoon,
  isWithinTradingWindow,
} from "./pickUpTimeHelper";
import { DEFAULT_PREP_TIMES } from "./prepTimes";

/**
 * These run in the machine's own timezone, as the picker does in the browser.
 * A bare `new Date("...T14:00:00")` is therefore local, which is what the
 * helpers compare against.
 */
const at = (day: string, time: string) => new Date(`${day}T${time}`);

/** A Monday: the shop trades 12:30 PM to 9:30 PM, so `open` is 12.5. */
const MONDAY = "2026-03-02";
/** A Friday: 12 PM to 10 PM, so `open` is a whole 12. */
const FRIDAY = "2026-03-06";

const noDaysOff: Date[] = [];

const mondayHours = getBusinessHoursForDate(at(MONDAY, "12:00:00"));
const fridayHours = getBusinessHoursForDate(at(FRIDAY, "12:00:00"));

describe("isWithinTradingWindow", () => {
  /**
   * The bug this was written for. Switching from ASAP to "Pick up later" sent
   * the pick-up time to 12:30 — the opening time, often hours in the past.
   *
   * The old check compared the *minute component* of the slot against the
   * minute component of opening and closing. With a 12:30 open that accepted
   * only slots whose minutes were 30 to 39, and pushed everything else back to
   * the opening time. 2:10 PM is a perfectly ordinary slot that it rejected.
   */
  it("accepts a mid-afternoon slot whose minutes are not the opening minutes", () => {
    expect(isWithinTradingWindow(at(MONDAY, "14:10:00"), mondayHours)).toBe(
      true,
    );
  });

  it.each(["12:30:00", "13:00:00", "17:45:00", "21:20:00"])(
    "accepts %s on a 12:30-21:30 day",
    (time) => {
      expect(isWithinTradingWindow(at(MONDAY, time), mondayHours)).toBe(true);
    },
  );

  // The old check compared getHours() (12) against the fractional open (12.5),
  // so it rejected the first slot of the day.
  it("accepts the opening slot itself", () => {
    expect(isWithinTradingWindow(at(MONDAY, "12:30:00"), mondayHours)).toBe(
      true,
    );
  });

  it("rejects before opening", () => {
    expect(isWithinTradingWindow(at(MONDAY, "12:29:00"), mondayHours)).toBe(
      false,
    );
    expect(isWithinTradingWindow(at(MONDAY, "09:00:00"), mondayHours)).toBe(
      false,
    );
  });

  // Last orders are ten minutes before close, matching the order server.
  it("rejects inside the last ten minutes", () => {
    expect(isWithinTradingWindow(at(MONDAY, "21:20:00"), mondayHours)).toBe(
      true,
    );
    expect(isWithinTradingWindow(at(MONDAY, "21:21:00"), mondayHours)).toBe(
      false,
    );
    expect(isWithinTradingWindow(at(MONDAY, "21:30:00"), mondayHours)).toBe(
      false,
    );
  });

  // On a whole-hour open the old check happened to accept minute 00 only, so
  // this day looked "mostly fine" and hid the bug.
  it("works the same on a day that opens on the hour", () => {
    expect(isWithinTradingWindow(at(FRIDAY, "12:00:00"), fridayHours)).toBe(
      true,
    );
    expect(isWithinTradingWindow(at(FRIDAY, "14:10:00"), fridayHours)).toBe(
      true,
    );
    expect(isWithinTradingWindow(at(FRIDAY, "11:59:00"), fridayHours)).toBe(
      false,
    );
  });

  it("rejects everything on a closed day", () => {
    expect(
      isWithinTradingWindow(at(MONDAY, "14:00:00"), {
        open: null,
        close: null,
        displayName: "Closed",
      } as never),
    ).toBe(false);
  });
});

describe("getTimeSlots", () => {
  const slotsOn = (day: string, nowTime: string, numberOfItems: number) =>
    getTimeSlots(at(day, nowTime), {
      numberOfItems,
      prepTimes: DEFAULT_PREP_TIMES,
      now: at(day, nowTime),
    });

  it("starts from the next ten-minute mark that clears preparation", () => {
    // Two items -> quoted 10 minutes.
    expect(slotsOn(MONDAY, "14:00:00", 2)[0]).toEqual(at(MONDAY, "14:10:00"));
  });

  /**
   * A larger order takes longer to make, so the first slot has to move out
   * with it. Offering 14:10 for an order the kitchen needs 20 minutes for is
   * how an order arrives late.
   */
  it("pushes the first slot out for a bigger order", () => {
    expect(slotsOn(MONDAY, "14:00:00", 5)[0]).toEqual(at(MONDAY, "14:20:00"));
    expect(slotsOn(MONDAY, "14:00:00", 10)[0]).toEqual(at(MONDAY, "14:20:00"));
  });

  it("never offers a slot before opening", () => {
    const slots = slotsOn(MONDAY, "09:00:00", 2);
    expect(slots[0]).toEqual(at(MONDAY, "12:30:00"));
  });

  it("stops ten minutes before closing", () => {
    const slots = slotsOn(MONDAY, "14:00:00", 2);
    expect(slots[slots.length - 1]).toEqual(at(MONDAY, "21:20:00"));
  });

  it("offers nothing once the shop has shut", () => {
    expect(slotsOn(MONDAY, "21:35:00", 2)).toEqual([]);
  });

  it("offers nothing when the last slot has passed", () => {
    expect(slotsOn(MONDAY, "21:15:00", 2)).toEqual([]);
  });

  // Every slot it hands out must survive the check the picker applies to it,
  // or the customer is sent back to the opening time again.
  it("only offers slots the trading window accepts", () => {
    for (const slot of slotsOn(MONDAY, "14:00:00", 3)) {
      expect(isWithinTradingWindow(slot, mondayHours)).toBe(true);
    }
  });

  it("offers the whole day for a future date", () => {
    const slots = getTimeSlots(at(FRIDAY, "00:00:00"), {
      numberOfItems: 2,
      prepTimes: DEFAULT_PREP_TIMES,
      now: at(MONDAY, "14:00:00"),
    });

    expect(slots[0]).toEqual(at(FRIDAY, "12:00:00"));
    expect(slots[slots.length - 1]).toEqual(at(FRIDAY, "21:50:00"));
  });
});

describe("isTooSoon", () => {
  const now = at(MONDAY, "14:00:00");
  const inMinutes = (n: number) => new Date(now.getTime() + n * 60_000);

  const tooSoon = (minutesAway: number, numberOfItems: number) =>
    isTooSoon(inMinutes(minutesAway), numberOfItems, DEFAULT_PREP_TIMES, now);

  it("holds a small order to the ten minute quote", () => {
    expect(tooSoon(9, 2)).toBe(true);
    expect(tooSoon(10, 2)).toBe(false);
    expect(tooSoon(30, 2)).toBe(false);
  });

  /**
   * The bug this exists for. A time chosen when the cart held two desserts is
   * ten minutes out; adding a fourth pushes the quote to fifteen, and the same
   * time is now sooner than the kitchen can manage. Both the picker and the
   * gate before payment compared against a fixed ten minutes, so neither
   * noticed.
   */
  it("rejects a time that only suited a smaller order", () => {
    expect(tooSoon(10, 2)).toBe(false);
    expect(tooSoon(10, 4)).toBe(true);
    expect(tooSoon(10, 7)).toBe(true);
  });

  it("moves the threshold with each tier", () => {
    expect(tooSoon(14, 5)).toBe(true);
    expect(tooSoon(15, 5)).toBe(false);
    expect(tooSoon(19, 8)).toBe(true);
    expect(tooSoon(20, 8)).toBe(false);
  });

  // A single dessert is still promised ten minutes, not the five it takes.
  it("keeps the customer-facing floor for one item", () => {
    expect(tooSoon(9, 1)).toBe(true);
    expect(tooSoon(10, 1)).toBe(false);
  });

  it("treats a time in the past as too soon", () => {
    expect(tooSoon(-30, 2)).toBe(true);
  });

  // Better to replace an unusable date than to keep it.
  it("treats an unusable date as too soon", () => {
    expect(isTooSoon(new Date("not a date"), 2, DEFAULT_PREP_TIMES, now)).toBe(
      true,
    );
  });

  it("follows the shop's configured times", () => {
    const slowShop = { ...DEFAULT_PREP_TIMES, upToThree: 25, quoteFloor: 25 };

    expect(isTooSoon(inMinutes(20), 2, slowShop, now)).toBe(true);
    expect(isTooSoon(inMinutes(25), 2, slowShop, now)).toBe(false);
  });

  // What the picker relies on: a slot it offers must never be rejected as too
  // soon a moment later.
  it("accepts every slot the picker offers for that order size", () => {
    for (const items of [1, 3, 5, 9]) {
      const slots = getTimeSlots(now, {
        numberOfItems: items,
        prepTimes: DEFAULT_PREP_TIMES,
        now,
      });

      expect(slots.length).toBeGreaterThan(0);
      expect(
        slots.every((slot) => !isTooSoon(slot, items, DEFAULT_PREP_TIMES, now)),
      ).toBe(true);
    }
  });
});

describe("getNextValidTime", () => {
  // What "Pick up later" now seeds with, so switching tabs cannot move the
  // customer's time backwards.
  it("lands inside trading hours during the day", () => {
    const next = getNextValidTime(2, noDaysOff, DEFAULT_PREP_TIMES);

    expect(next).not.toBeNull();
    if (!next) return;

    const hours = getBusinessHoursForDate(next);
    expect(isWithinTradingWindow(next, hours)).toBe(true);
  });
});
