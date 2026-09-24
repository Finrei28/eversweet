import { describe, expect, it } from "vitest";

import {
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
