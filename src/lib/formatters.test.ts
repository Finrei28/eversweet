import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { formatDate, getCollectionTime } from "./formatters";

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
