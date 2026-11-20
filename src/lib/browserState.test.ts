import { describe, expect, it } from "vitest";

import { msUntilNextMinute } from "./browserState";

/**
 * The home page's clock (`useMinuteClock`) ticks on each whole minute, so "Open today
 * until..." and the opening hours' "Today" move on the minute they change rather than
 * up to a minute late.
 */
describe("msUntilNextMinute", () => {
  it("waits a whole minute from the top of one", () => {
    expect(msUntilNextMinute(new Date("2026-11-20T10:59:00.000Z"))).toBe(
      60_000,
    );
  });

  it("waits only for what is left of the minute", () => {
    expect(msUntilNextMinute(new Date("2026-11-20T10:59:30.250Z"))).toBe(
      29_750,
    );
  });
});
