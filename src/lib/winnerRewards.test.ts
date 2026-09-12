import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";

import {
  defaultRewardExpiry,
  endOfDayNZ,
  monthLabel,
  rewardStatus,
} from "./winnerRewards";

/**
 * Assertions are on the absolute instant, so they hold whatever timezone the machine
 * running them is in. The Auckland re-read alongside each one is what makes the intent
 * legible.
 */
const inNZ = (date: Date) =>
  DateTime.fromJSDate(date).setZone("Pacific/Auckland").toISO();

describe("defaultRewardExpiry", () => {
  it("expires a September win at the end of October", () => {
    expect(inNZ(defaultRewardExpiry(9, 2026))).toBe(
      "2026-10-31T23:59:59.999+13:00",
    );
  });

  // luxon carries the year; month 12 plus one month is January of the next one.
  it("carries the year over a December win", () => {
    const expiry = defaultRewardExpiry(12, 2026);

    expect(inNZ(expiry)).toBe("2027-01-31T23:59:59.999+13:00");
    expect(expiry.toISOString()).toBe("2027-01-31T10:59:59.999Z");
  });

  it("knows how long February is in a leap year", () => {
    expect(inNZ(defaultRewardExpiry(1, 2028))).toBe(
      "2028-02-29T23:59:59.999+13:00",
    );
  });

  /**
   * The test that fails if someone rewrites this with plain `Date` arithmetic or
   * hardcodes an offset. A March win expires at the end of April, which is *after* NZ
   * daylight time ends on the first Sunday of April - so the offset is +12:00, not the
   * +13:00 every other case here produces.
   */
  it("uses the offset in force at the expiry, not the one at the win", () => {
    expect(inNZ(defaultRewardExpiry(3, 2026))).toBe(
      "2026-04-30T23:59:59.999+12:00",
    );
  });

  it("picks up daylight time when the expiry falls after it starts", () => {
    // Won in August, expires 30 September - after DST begins on the last Sunday.
    expect(inNZ(defaultRewardExpiry(8, 2026))).toBe(
      "2026-09-30T23:59:59.999+13:00",
    );
  });

  /**
   * The code is valid *through* its last day, not up to the start of it. A .000 here
   * would silently shorten every prize by a day.
   */
  it("lands on the last instant of the day, not the first", () => {
    expect(defaultRewardExpiry(9, 2026).getMilliseconds()).toBe(999);
  });
});

describe("endOfDayNZ", () => {
  it("pins the clock-face date the admin picked to the end of that day in NZ", () => {
    // What a calendar hands back: midnight, in whatever zone the browser is in.
    const picked = new Date(2026, 9, 15, 0, 0, 0);

    expect(inNZ(endOfDayNZ(picked))).toBe("2026-10-15T23:59:59.999+13:00");
  });

  /**
   * keepLocalTime is the whole point: an admin whose browser is hours behind NZ still
   * gets the date they clicked, not the one that instant happens to be in Auckland.
   */
  it("keeps the date the admin saw rather than shifting it", () => {
    const picked = new Date(2026, 0, 3, 0, 0, 0);

    expect(inNZ(endOfDayNZ(picked))).toBe("2026-01-03T23:59:59.999+13:00");
  });
});

describe("rewardStatus", () => {
  const NOW = new Date("2026-06-15T12:00:00.000Z");
  const day = (offset: number) =>
    new Date(NOW.getTime() + offset * 24 * 60 * 60 * 1000);

  it("is UNASSIGNED with no reward", () => {
    expect(rewardStatus(null, NOW)).toBe("UNASSIGNED");
    expect(rewardStatus(undefined, NOW)).toBe("UNASSIGNED");
  });

  it("is ASSIGNED while the expiry is ahead", () => {
    expect(
      rewardStatus({ expiresAt: day(7), redeemedAt: null }, NOW),
    ).toBe("ASSIGNED");
  });

  it("is EXPIRED once the expiry has passed unredeemed", () => {
    expect(
      rewardStatus({ expiresAt: day(-1), redeemedAt: null }, NOW),
    ).toBe("EXPIRED");
  });

  /**
   * Redeemed beats expired. A prize collected on its last day was still collected, and
   * the row must not start reading "expired" the next morning.
   */
  it("stays REDEEMED after the expiry passes", () => {
    expect(
      rewardStatus({ expiresAt: day(-1), redeemedAt: day(-2) }, NOW),
    ).toBe("REDEEMED");
  });

  // Inclusive, matching the offer window convention.
  it("is still ASSIGNED exactly on the expiry instant", () => {
    expect(rewardStatus({ expiresAt: NOW, redeemedAt: null }, NOW)).toBe(
      "ASSIGNED",
    );
  });
});

describe("monthLabel", () => {
  it("names the month in each language", () => {
    expect(monthLabel(9, 2026, "en")).toBe("September 2026");
    expect(monthLabel(9, 2026, "zh")).toBe("2026年9月");
  });
});
