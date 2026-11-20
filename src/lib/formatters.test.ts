import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { formatDate, formatShortDate, getCollectionTime } from "./formatters";

/**
 * The confirmation email is rendered on Vercel, which runs in UTC. These formatters used
 * to follow the runtime's zone, so an 8:29 PM pick-up in Auckland was emailed as 8:29 AM.
 */
describe("pick-up time formatting on a UTC server", () => {
  const original = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "UTC";
  });
  afterAll(() => {
    process.env.TZ = original;
  });

  // 8:29 PM on Thursday 17 September 2026 in Auckland (NZST, UTC+12).
  const pickUp = new Date("2026-09-17T08:29:00Z");

  it("really is running in UTC", () => {
    expect(pickUp.getTimezoneOffset()).toBe(0);
  });

  it("gives the Auckland date and time", () => {
    expect(getCollectionTime(pickUp)).toMatch(/17\/09\/2026.*8:29\s*pm/i);
  });

  it("gives the Auckland weekday and time in the long form", () => {
    expect(formatDate(pickUp.toISOString())).toMatch(/Thursday.*8:29\s*pm/i);
  });
});

/**
 * The admin order tables wrote a date with no zone, so the server - in UTC, as on Vercel -
 * and a browser in Auckland wrote different days for an order placed after Auckland
 * midnight but before UTC's, and React logged a hydration error on every load of
 * /admin/orders.
 */
describe.each(["UTC", "Pacific/Auckland", "America/Los_Angeles"])(
  "short dates with the process in %s",
  (zone) => {
    const original = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = zone;
    });
    afterAll(() => {
      process.env.TZ = original;
    });

    it("gives the Auckland day just after Auckland midnight", () => {
      // 1:00 AM on Thursday 1 October 2026 in Auckland (NZDT, UTC+13); still 30 September
      // in UTC and in Los Angeles.
      expect(formatShortDate(new Date("2026-09-30T12:00:00Z"))).toBe(
        "1/10/2026",
      );
    });

    it("gives the Auckland day just before Auckland midnight", () => {
      // 11:30 PM on Friday 20 November 2026 in Auckland; already 20 November in UTC.
      expect(formatShortDate(new Date("2026-11-20T10:30:00Z"))).toBe(
        "20/11/2026",
      );
    });
  },
);
