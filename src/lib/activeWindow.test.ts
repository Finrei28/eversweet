import { describe, expect, it, vi } from "vitest";

// pricing.ts is server-only; the predicate under test is not, but importing it to pin
// the delegation drags that guard in.
vi.mock("server-only", () => ({}));

import { isWithinActiveWindow } from "./activeWindow";
import { isPromoActive } from "~/server/pricing";

const NOW = new Date("2026-06-15T12:00:00.000Z");

const ms = (offset: number) => new Date(NOW.getTime() + offset);

const window = (
  overrides: Partial<{
    isActive: boolean;
    startsAt: Date | null;
    endsAt: Date | null;
  }> = {},
) => ({ isActive: true, startsAt: null, endsAt: null, ...overrides });

describe("isWithinActiveWindow", () => {
  it("is live when both bounds are open", () => {
    expect(isWithinActiveWindow(window(), NOW)).toBe(true);
  });

  /**
   * The flag beats the window in every direction. A paused thing sitting inside
   * a perfectly valid date range is still paused.
   */
  it("is not live when switched off, whatever the dates say", () => {
    expect(isWithinActiveWindow(window({ isActive: false }), NOW)).toBe(false);
    expect(
      isWithinActiveWindow(
        window({ isActive: false, startsAt: ms(-1000), endsAt: ms(1000) }),
        NOW,
      ),
    ).toBe(false);
  });

  // Both bounds are inclusive: live at the instant it starts and the instant it ends.
  it("is live exactly on startsAt and one ms after, not one ms before", () => {
    expect(isWithinActiveWindow(window({ startsAt: NOW }), NOW)).toBe(true);
    expect(isWithinActiveWindow(window({ startsAt: ms(-1) }), NOW)).toBe(true);
    expect(isWithinActiveWindow(window({ startsAt: ms(1) }), NOW)).toBe(false);
  });

  it("is live exactly on endsAt and one ms before, not one ms after", () => {
    expect(isWithinActiveWindow(window({ endsAt: NOW }), NOW)).toBe(true);
    expect(isWithinActiveWindow(window({ endsAt: ms(1) }), NOW)).toBe(true);
    expect(isWithinActiveWindow(window({ endsAt: ms(-1) }), NOW)).toBe(false);
  });

  it("treats a start bound with no end bound as open-ended", () => {
    expect(
      isWithinActiveWindow(window({ startsAt: ms(-1000), endsAt: null }), NOW),
    ).toBe(true);
  });

  /**
   * Both call sites can hand this a relation that is simply not there - a dessert
   * with no promo, an offer that failed to load - so a missing thing is never live
   * rather than a crash.
   */
  it("is not live for null or undefined", () => {
    expect(isWithinActiveWindow(null, NOW)).toBe(false);
    expect(isWithinActiveWindow(undefined, NOW)).toBe(false);
  });
});

/**
 * isPromoActive delegates here, and it is the one caller in the payment path. These
 * pin the delegation so that inlining a second copy of the predicate fails loudly.
 */
describe("isPromoActive", () => {
  const promo = (
    overrides: Partial<{
      isActive: boolean;
      startsAt: Date | null;
      endsAt: Date | null;
    }> = {},
  ) =>
    ({
      type: "PERCENTAGE" as const,
      value: 10,
      ...window(overrides),
    });

  it("matches isWithinActiveWindow on the cases that decide a price", () => {
    expect(isPromoActive(promo(), NOW)).toBe(true);
    expect(isPromoActive(promo({ isActive: false }), NOW)).toBe(false);
    expect(isPromoActive(promo({ startsAt: ms(1) }), NOW)).toBe(false);
    expect(isPromoActive(promo({ endsAt: ms(-1) }), NOW)).toBe(false);
    expect(isPromoActive(null, NOW)).toBe(false);
  });
});
