import { describe, expect, it } from "vitest";

import { canActivate, hasEnded, isOfferRunning, offerState } from "./offers";

const NOW = new Date("2026-06-15T12:00:00.000Z");

const day = (offset: number) =>
  new Date(NOW.getTime() + offset * 24 * 60 * 60 * 1000);

const ms = (offset: number) => new Date(NOW.getTime() + offset);

const offer = (
  overrides: Partial<{
    isActive: boolean;
    startsAt: Date | null;
    endsAt: Date | null;
    archivedAt: Date | null;
  }> = {},
) => ({
  isActive: true,
  startsAt: null,
  endsAt: null,
  archivedAt: null,
  ...overrides,
});

/**
 * The predicate the whole run lifecycle turns on: it decides whether editing is blocked,
 * whether activation is refused, and whether Close run is offered. Deliberately blind to
 * `isActive`.
 */
describe("hasEnded", () => {
  it("is false with no end date", () => {
    expect(hasEnded(offer(), NOW)).toBe(false);
  });

  it("is false while the end date is ahead", () => {
    expect(hasEnded(offer({ endsAt: day(1) }), NOW)).toBe(false);
  });

  // Inclusive, matching isWithinActiveWindow: still running at the instant it ends.
  it("is false at exactly the end instant, true one ms later", () => {
    expect(hasEnded(offer({ endsAt: NOW }), NOW)).toBe(false);
    expect(hasEnded(offer({ endsAt: ms(-1) }), NOW)).toBe(true);
  });

  /**
   * The reason this exists rather than reading the ENDED badge. A paused offer whose end
   * date has passed still counts as ended - otherwise it could be edited back into its
   * window and reactivated without its run ever being closed.
   */
  it("ignores isActive entirely", () => {
    expect(hasEnded(offer({ isActive: false, endsAt: day(-1) }), NOW)).toBe(
      true,
    );
    expect(hasEnded(offer({ isActive: true, endsAt: day(-1) }), NOW)).toBe(
      true,
    );
  });

  it("is exactly the negation of canActivate", () => {
    for (const endsAt of [null, day(1), day(-1), NOW, ms(-1)]) {
      const o = offer({ endsAt });
      expect(canActivate(o, NOW)).toBe(!hasEnded(o, NOW));
    }
  });
});

describe("offerState", () => {
  it("is LIVE with no bounds and the switch on", () => {
    expect(offerState(offer(), NOW)).toBe("LIVE");
  });

  it("is SCHEDULED before its start date", () => {
    expect(offerState(offer({ startsAt: day(7) }), NOW)).toBe("SCHEDULED");
  });

  it("is ENDED after its end date", () => {
    expect(offerState(offer({ endsAt: day(-1) }), NOW)).toBe("ENDED");
  });

  it("is PAUSED when switched off", () => {
    expect(offerState(offer({ isActive: false }), NOW)).toBe("PAUSED");
  });

  it("is ARCHIVED when archived", () => {
    expect(offerState(offer({ archivedAt: day(-30) }), NOW)).toBe("ARCHIVED");
  });

  /**
   * The precedence cases. Archiving clears isActive, so an archived row with the flag
   * still set is stale data - the admin should see "archived", not "live".
   */
  it("reads archived before anything else", () => {
    expect(
      offerState(offer({ archivedAt: day(-30), isActive: true }), NOW),
    ).toBe("ARCHIVED");
    expect(
      offerState(
        offer({ archivedAt: day(-30), isActive: true, startsAt: day(7) }),
        NOW,
      ),
    ).toBe("ARCHIVED");
  });

  /**
   * ENDED outranks PAUSED so the badge means exactly `hasEnded` - the same condition
   * that blocks editing and offers Close run. The other ordering hid a finished run
   * behind a PAUSED label, leaving the admin no sign that the run needed closing.
   */
  it("reads ended before paused", () => {
    expect(offerState(offer({ isActive: false, endsAt: day(-1) }), NOW)).toBe(
      "ENDED",
    );
  });

  it("still reads paused when the end date is ahead", () => {
    expect(offerState(offer({ isActive: false, endsAt: day(1) }), NOW)).toBe(
      "PAUSED",
    );
  });
});

describe("canActivate", () => {
  it("allows an offer with no end date", () => {
    expect(canActivate(offer({ isActive: false }), NOW)).toBe(true);
  });

  it("allows an offer whose end date is still ahead", () => {
    expect(canActivate(offer({ isActive: false, endsAt: day(7) }), NOW)).toBe(
      true,
    );
  });

  /**
   * The guard the activate mutation leans on. Switching this on would leave it flagged
   * active and still dead, which reads as a bug from behind the counter.
   */
  it("refuses an offer whose end date has passed", () => {
    expect(canActivate(offer({ isActive: false, endsAt: day(-1) }), NOW)).toBe(
      false,
    );
  });

  // A scheduled offer is not a broken one.
  it("allows an offer that has not started yet", () => {
    expect(canActivate(offer({ isActive: false, startsAt: day(7) }), NOW)).toBe(
      true,
    );
  });
});

describe("isOfferRunning", () => {
  it("is true only for a live, unarchived offer", () => {
    expect(isOfferRunning(offer(), NOW)).toBe(true);
    expect(isOfferRunning(offer({ archivedAt: day(-1) }), NOW)).toBe(false);
    expect(isOfferRunning(offer({ isActive: false }), NOW)).toBe(false);
    expect(isOfferRunning(offer({ startsAt: day(7) }), NOW)).toBe(false);
    expect(isOfferRunning(offer({ endsAt: day(-1) }), NOW)).toBe(false);
  });
});
