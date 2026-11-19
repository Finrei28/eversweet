import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("~/server/db", () => ({ db: { loyaltySetting: { findFirst } } }));

import { isLeaderboardShown } from "./leaderboardVisibility";

/**
 * Whether the home page's app band may mention the monthly leaderboard.
 *
 * The switch on /admin/settings hides the board in the app, and a website advertising a
 * leaderboard nobody can find there would be making a claim the app does not keep. So this
 * reads the same column the order server does, and leans the other way when it cannot.
 */
describe("isLeaderboardShown", () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  it("is shown while the switch is on", async () => {
    findFirst.mockResolvedValue({ leaderboardHiddenAt: null });

    await expect(isLeaderboardShown()).resolves.toBe(true);
  });

  it("is not shown while the switch is off", async () => {
    findFirst.mockResolvedValue({
      leaderboardHiddenAt: new Date("2026-11-01T00:00:00+13:00"),
    });

    await expect(isLeaderboardShown()).resolves.toBe(false);
  });

  /** An unseeded table is shown in the app (`isLeaderboardShown` on the order server). */
  it("is shown when the settings row has never been written", async () => {
    findFirst.mockResolvedValue(null);

    await expect(isLeaderboardShown()).resolves.toBe(true);
  });

  /**
   * The opposite of the order server, deliberately: there a failed read must not take the
   * board away from customers, here it only costs one line of advertising, and leaving the
   * line out can never be untrue.
   */
  it("leaves the leaderboard out when the setting cannot be read", async () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    findFirst.mockRejectedValue(new Error("connection refused"));

    await expect(isLeaderboardShown()).resolves.toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
