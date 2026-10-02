import { describe, expect, it } from "vitest";

import {
  isAnnouncementShowing as showing,
  MEMBER_RATE_TOKEN,
  WHILE_POINTS_EXPIRE_TOKEN,
  previewBenefit,
  showsOnlyWhilePointsExpire,
} from "./shopSettings";

/**
 * The benefit preview on /admin/settings. The order server resolves the same tokens when it
 * serves the benefits (`lib/membership.ts` there); the two repos share no package, so the
 * spellings are pinned here - a token this screen previews and the server does not recognise
 * would reach customers with its braces showing.
 */
describe("benefit tokens", () => {
  it("spells the tokens exactly as the order server does", () => {
    expect(MEMBER_RATE_TOKEN).toBe("{{memberRate}}");
    expect(WHILE_POINTS_EXPIRE_TOKEN).toBe("{{whilePointsExpire}}");
  });

  it("previews a points-expiry benefit without its token", () => {
    expect(
      previewBenefit(
        `${WHILE_POINTS_EXPIRE_TOKEN}Your Sweet Points never expire while you're a member`,
        1.5,
      ),
    ).toBe("Your Sweet Points never expire while you're a member");
  });

  it("still fills in the member rate", () => {
    expect(
      previewBenefit(`Earn ${MEMBER_RATE_TOKEN}x loyalty points`, 1.5),
    ).toBe("Earn 1.5x loyalty points");
  });

  it("knows which benefits depend on the expiry switch", () => {
    expect(
      showsOnlyWhilePointsExpire(
        `${WHILE_POINTS_EXPIRE_TOKEN}Members keep points`,
      ),
    ).toBe(true);
    expect(showsOnlyWhilePointsExpire("Cancel anytime")).toBe(false);
  });
});

/**
 * Whether an announcement is in the app's pop-up, as the save's limit and the card's
 * "N of 5 showing" count it (the app's TODO item 8, entry 1).
 */
describe("isAnnouncementShowing", () => {
  const today = "2026-10-05";

  it("shows one switched on with no end", () => {
    expect(showing({ isActive: true, endsOn: null }, today)).toBe(true);
  });

  it("shows one through its last day, and not after", () => {
    expect(showing({ isActive: true, endsOn: "2026-10-05" }, today)).toBe(true);
    expect(showing({ isActive: true, endsOn: "2026-10-04" }, today)).toBe(false);
  });

  it("never shows one switched off, whatever its end", () => {
    expect(showing({ isActive: false, endsOn: null }, today)).toBe(false);
    expect(showing({ isActive: false, endsOn: "2026-12-31" }, today)).toBe(false);
  });
});
