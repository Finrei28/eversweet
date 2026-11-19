import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("~/server/db", () => ({ db: { loyaltySetting: { findFirst } } }));

import { getAppPromotion } from "./appPromotion";

/**
 * What the website's app promotions may claim, read from the settings /admin/settings edits.
 *
 * Each of these is something the shop can switch off without a deploy - the leaderboard
 * hidden, earning paused with a rate or modifier of 0, the member bonus set back to 1x - and
 * a website still advertising it would be promising what the app no longer gives.
 */
describe("getAppPromotion", () => {
  const row = (fields: Record<string, unknown> = {}) => ({
    pointsPerDollar: 6,
    memberBonusPercent: 150,
    modifierPercent: 100,
    leaderboardHiddenAt: null,
    ...fields,
  });

  beforeEach(() => {
    findFirst.mockReset();
  });

  it("claims all of it with the usual settings", async () => {
    findFirst.mockResolvedValue(row());

    await expect(getAppPromotion()).resolves.toEqual({
      pointsEarned: true,
      memberRateHigher: true,
      leaderboardShown: true,
    });
  });

  /** An unseeded table is the order server's DEFAULT_LOYALTY_RATES, and a shown board. */
  it("claims all of it when the settings row has never been written", async () => {
    findFirst.mockResolvedValue(null);

    await expect(getAppPromotion()).resolves.toEqual({
      pointsEarned: true,
      memberRateHigher: true,
      leaderboardShown: true,
    });
  });

  it("leaves the leaderboard out while it is hidden", async () => {
    findFirst.mockResolvedValue(
      row({ leaderboardHiddenAt: new Date("2026-11-01T00:00:00+13:00") }),
    );

    await expect(getAppPromotion()).resolves.toEqual({
      pointsEarned: true,
      memberRateHigher: true,
      leaderboardShown: false,
    });
  });

  /**
   * Both a rate of 0 and a modifier of 0 pause earning. Nothing is earned, so no member
   * earns more, and a leaderboard of points earned this month has nobody on it.
   */
  it.each([
    ["a rate of 0", { pointsPerDollar: 0 }],
    ["a modifier of 0", { modifierPercent: 0 }],
  ])("claims no points with %s", async (_, fields) => {
    findFirst.mockResolvedValue(row(fields));

    await expect(getAppPromotion()).resolves.toEqual({
      pointsEarned: false,
      memberRateHigher: false,
      leaderboardShown: false,
    });
  });

  it("claims no higher member rate when members earn 1x", async () => {
    findFirst.mockResolvedValue(row({ memberBonusPercent: 100 }));

    await expect(getAppPromotion()).resolves.toEqual({
      pointsEarned: true,
      memberRateHigher: false,
      leaderboardShown: true,
    });
  });

  /**
   * The opposite of the order server, deliberately: there a failed read must not take
   * anything from customers, here it only costs a line of advertising, and leaving a line
   * out can never be untrue.
   */
  it("claims none of it when the settings cannot be read", async () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    findFirst.mockRejectedValue(new Error("connection refused"));

    await expect(getAppPromotion()).resolves.toEqual({
      pointsEarned: false,
      memberRateHigher: false,
      leaderboardShown: false,
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
