import { DateTime, Settings } from "luxon";
import { describe, expect, it } from "vitest";

import {
  defaultRewardExpiry,
  endOfDayNZ,
  finishedMonths,
  formatPrizeCode,
  monthLabel,
  pickedDay,
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

/**
 * Runs `fn` as if the process were in `zone`. luxon's default zone is what `fromJSDate`
 * reads a `Date` in, so this is how a test plays the admin's browser, or Vercel.
 */
const inZone = <T>(zone: string, fn: () => T): T => {
  const previous = Settings.defaultZone;
  Settings.defaultZone = zone;
  try {
    return fn();
  } finally {
    Settings.defaultZone = previous;
  }
};

/** What the calendar hands back for 31 October in an Auckland browser: midnight there. */
const CLICKED_31_OCTOBER_IN_NZ = new Date("2026-10-30T11:00:00.000Z");

describe("pickedDay", () => {
  it("reads the day the admin clicked, in the browser's zone", () => {
    expect(
      inZone("Pacific/Auckland", () => pickedDay(CLICKED_31_OCTOBER_IN_NZ)),
    ).toBe("2026-10-31");
  });

  /**
   * Why it has to run in the browser: the same instant read on a UTC host is the day
   * before. This is the reading the router used to do.
   */
  it("gives the day before when the same click is read in UTC", () => {
    expect(inZone("UTC", () => pickedDay(CLICKED_31_OCTOBER_IN_NZ))).toBe(
      "2026-10-30",
    );
  });

  it("gives an admin behind NZ the day they clicked, not Auckland's", () => {
    const clicked = inZone("America/Los_Angeles", () =>
      DateTime.fromObject({ year: 2026, month: 1, day: 3 }).toJSDate(),
    );

    expect(inZone("America/Los_Angeles", () => pickedDay(clicked))).toBe(
      "2026-01-03",
    );
  });
});

describe("endOfDayNZ", () => {
  it("pins a day to its last instant in Auckland", () => {
    expect(inNZ(endOfDayNZ("2026-10-15"))).toBe(
      "2026-10-15T23:59:59.999+13:00",
    );
  });

  /**
   * The test that fails if the day is ever read off a `Date` on the server again. On
   * Vercel that made "collect by 31 October" expire at the end of the 30th.
   */
  it("gives the same instant whatever zone the host runs in", () => {
    for (const zone of ["UTC", "Pacific/Auckland", "America/Los_Angeles"]) {
      expect(inZone(zone, () => endOfDayNZ("2026-10-31").toISOString())).toBe(
        "2026-10-31T10:59:59.999Z",
      );
    }
  });

  it("uses the offset in force on that day", () => {
    expect(inNZ(endOfDayNZ("2026-06-30"))).toBe(
      "2026-06-30T23:59:59.999+12:00",
    );
  });

  // A prize given its default deadline and then reworded must not have it moved.
  it("lands exactly on the default expiry for that day", () => {
    expect(endOfDayNZ("2026-10-31")).toEqual(defaultRewardExpiry(9, 2026));
  });
});

describe("formatPrizeCode", () => {
  it("groups a stored code the way the order server shows it", () => {
    expect(formatPrizeCode("ABCD2345")).toBe("ABCD-2345");
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

describe("finishedMonths", () => {
  // Never the month still being competed for: settling it early would freeze a podium
  // with weeks of points still to come, and a settled month is never revisited.
  it("starts at last month, newest first", () => {
    const now = new Date("2026-09-13T01:00:00Z"); // 13 September, 13:00 in Auckland

    expect(finishedMonths(3, now)).toEqual([
      { month: 8, year: 2026 },
      { month: 7, year: 2026 },
      { month: 6, year: 2026 },
    ]);
  });

  it("carries the year back over January", () => {
    const now = new Date("2026-02-10T01:00:00Z");

    expect(finishedMonths(3, now)).toEqual([
      { month: 1, year: 2026 },
      { month: 12, year: 2025 },
      { month: 11, year: 2025 },
    ]);
  });

  // 31 August 20:00 UTC is already 1 September in Auckland, so August has finished there
  // even though a UTC clock says it has not. The server runs in UTC; this is the bug the
  // cron itself once had.
  it("reads the month on the Auckland calendar, not the host's", () => {
    const now = new Date("2026-08-31T20:00:00Z");

    expect(finishedMonths(1, now)).toEqual([{ month: 8, year: 2026 }]);
  });

  it("offers a year of months by default", () => {
    expect(finishedMonths()).toHaveLength(12);
  });
});
