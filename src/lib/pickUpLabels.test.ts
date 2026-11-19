import { describe, expect, it } from "vitest";

import {
  dayChip,
  hoursLine,
  orderPlacedLabel,
  pickUpDateTimeLabel,
  pickUpTimeLabel,
  SLOTS_SHOWN,
  summaryPickUpLine,
  visibleSlots,
} from "./pickUpLabels";
import { atNZ } from "./pickUpTimes";

/**
 * What the checkout's pick-up section and order summary, and the order page, say about a time. Every label is
 * read on the Auckland clock, never the process's: a customer's browser can be anywhere,
 * and CI runs in UTC, where an Auckland morning is still the day before. The cases pick
 * instants whose UTC day differs from their Auckland one, so a label read off the wrong
 * clock fails here on any machine.
 */
describe("pickUpTimeLabel", () => {
  it("writes an Auckland evening as the mock-ups do", () => {
    // 6:42 pm on Friday 20 November is 05:42 UTC the same day.
    const friday = atNZ("2026-11-20", 18 * 60 + 42);
    expect(pickUpTimeLabel(friday, "en")).toBe("Fri 20 Nov, 6:42 pm");
    expect(pickUpTimeLabel(friday, "zh")).toBe("11月20日（周五）6:42 PM");
  });

  it("keeps an Auckland morning on its own day, which is the day before in UTC", () => {
    // 9:00 am on Saturday 21 November is 20:00 UTC on Friday.
    const saturday = atNZ("2026-11-21", 9 * 60);
    expect(saturday.toISOString()).toBe("2026-11-20T20:00:00.000Z");
    expect(pickUpTimeLabel(saturday, "en")).toBe("Sat 21 Nov, 9:00 am");
    expect(pickUpTimeLabel(saturday, "zh")).toBe("11月21日（周六）9:00 AM");
  });

  it("reads noon and midday hours the way the opening hours do", () => {
    expect(pickUpTimeLabel(atNZ("2026-11-22", 12 * 60), "en")).toBe(
      "Sun 22 Nov, 12:00 pm",
    );
  });

  it("follows the clocks across daylight saving", () => {
    // NZDT ends on Sunday 5 April 2026 at 3 am; the afternoon is NZST.
    expect(pickUpTimeLabel(atNZ("2026-04-05", 15 * 60 + 30), "en")).toBe(
      "Sun 5 Apr, 3:30 pm",
    );
  });
});

describe("pickUpDateTimeLabel", () => {
  it("writes the order page's pick-up time as the mock-ups do", () => {
    const friday = atNZ("2026-11-20", 18 * 60 + 42);
    expect(pickUpDateTimeLabel(friday, "en")).toBe(
      "6:42 pm, Friday 20 November",
    );
    expect(pickUpDateTimeLabel(friday, "zh")).toBe("11月20日（周五）6:42 PM");
  });

  it("keeps an Auckland morning on its own day, which is the day before in UTC", () => {
    const saturday = atNZ("2026-11-21", 9 * 60);
    expect(pickUpDateTimeLabel(saturday, "en")).toBe(
      "9:00 am, Saturday 21 November",
    );
    expect(pickUpDateTimeLabel(saturday, "zh")).toBe("11月21日（周六）9:00 AM");
  });

  it("names the month in full", () => {
    expect(pickUpDateTimeLabel(atNZ("2026-09-30", 12 * 60), "en")).toBe(
      "12:00 pm, Wednesday 30 September",
    );
  });
});

describe("orderPlacedLabel", () => {
  it("dates an order with its year, on the Auckland clock", () => {
    // 8:07 am on Friday 20 November is 19:07 UTC on Thursday.
    const placed = new Date("2026-11-19T19:07:30Z");
    expect(orderPlacedLabel(placed, "en")).toBe("20 Nov 2026, 8:07 am");
    expect(orderPlacedLabel(placed, "zh")).toBe("2026年11月20日 8:07 AM");
  });

  it("puts half past midnight on New Year's Day in the new year", () => {
    // 12:30 am on 1 January 2027 is 11:30 UTC on 31 December.
    const placed = new Date("2026-12-31T11:30:00Z");
    expect(orderPlacedLabel(placed, "en")).toBe("1 Jan 2027, 12:30 am");
    expect(orderPlacedLabel(placed, "zh")).toBe("2027年1月1日 12:30 AM");
  });
});

describe("summaryPickUpLine", () => {
  const time = atNZ("2026-11-20", 18 * 60 + 42);

  it("says an ASAP time is an estimate", () => {
    expect(summaryPickUpLine(time, true, "en")).toBe(
      "Pick up Fri 20 Nov, about 6:42 pm",
    );
    expect(summaryPickUpLine(time, true, "zh")).toBe(
      "取货时间：11月20日（周五）约 6:42 PM",
    );
  });

  it("states a picked time as it is", () => {
    expect(summaryPickUpLine(time, false, "en")).toBe(
      "Pick up Fri 20 Nov, 6:42 pm",
    );
    expect(summaryPickUpLine(time, false, "zh")).toBe(
      "取货时间：11月20日（周五）6:42 PM",
    );
  });
});

describe("dayChip", () => {
  it("calls today Today and every other day by its weekday", () => {
    expect(dayChip("2026-11-20", "2026-11-20", true, "en")).toEqual({
      weekday: "Today",
      day: "20",
      label: "Today, Fri 20 Nov",
    });
    expect(dayChip("2026-11-21", "2026-11-20", true, "en")).toEqual({
      weekday: "Sat",
      day: "21",
      label: "Sat 21 Nov",
    });
    expect(dayChip("2026-11-21", "2026-11-20", true, "zh")).toEqual({
      weekday: "周六",
      day: "21",
      label: "11月21日（周六）",
    });
  });

  it("says why a day cannot be picked", () => {
    expect(dayChip("2026-11-25", "2026-11-20", false, "en").label).toBe(
      "Wed 25 Nov, no pick-up times",
    );
    expect(dayChip("2026-11-20", "2026-11-20", false, "zh").label).toBe(
      "今天，11月20日（周五），无可取货时间",
    );
  });

  it("rolls over the end of a month and a year", () => {
    expect(dayChip("2027-01-01", "2026-12-31", true, "en")).toMatchObject({
      weekday: "Fri",
      day: "1",
    });
  });
});

describe("hoursLine", () => {
  it("gives the day's hours and its last pick-up, ten minutes before closing", () => {
    const friday = { opensAt: 12 * 60, closesAt: 22 * 60 };
    expect(hoursLine("2026-11-20", friday, "en")).toBe(
      "Hours: 12:00 pm – 10:00 pm. Last pick-up on Friday: 9:50 pm.",
    );
    expect(hoursLine("2026-11-20", friday, "zh")).toBe(
      "营业时间：12:00 PM – 10:00 PM。周五最后取货时间：9:50 PM。",
    );
  });
});

describe("visibleSlots", () => {
  // Every ten minutes from 12:00 pm: 60 of them to 9:50 pm.
  const slots = Array.from({ length: 60 }, (_, i) =>
    atNZ("2026-11-20", 12 * 60 + i * 10),
  );

  it("shows the first few, with more to come", () => {
    const { shown, more } = visibleSlots(slots, null, false);
    expect(shown).toHaveLength(SLOTS_SHOWN);
    expect(shown[0]).toBe(slots[0]);
    expect(more).toBe(true);
  });

  it("shows them all once Later times is pressed", () => {
    expect(visibleSlots(slots, null, true)).toEqual({
      shown: slots,
      more: false,
    });
  });

  it("never hides the time already picked", () => {
    const picked = slots[30]!.getTime();
    const { shown, more } = visibleSlots(slots, picked, false);
    expect(shown.map((s) => s.getTime())).toContain(picked);
    expect(shown).toHaveLength(31);
    expect(more).toBe(true);
  });

  it("offers nothing more for a short day", () => {
    expect(visibleSlots(slots.slice(0, 5), null, false)).toEqual({
      shown: slots.slice(0, 5),
      more: false,
    });
  });
});
