import { describe, expect, it } from "vitest";

import { promoDiscountInCents } from "./dessertPricing";

/**
 * The discount a dessert's promotion takes off, as the menu, the popular choices and
 * the customise dialog each worked it out inline: a fixed amount as it is, a percentage
 * of the price rounded down to the cent. Display only - checkout reprices on the server.
 */
const dessert = (
  priceInCents: number,
  promo: { type: "PERCENTAGE" | "FIXED_AMOUNT"; value: number } | null,
) => ({ priceInCents, promo });

describe("promoDiscountInCents", () => {
  it("takes nothing off a dessert with no promotion", () => {
    expect(promoDiscountInCents(dessert(999, null))).toBe(0);
  });

  it("takes a fixed amount off as it is", () => {
    expect(
      promoDiscountInCents(dessert(999, { type: "FIXED_AMOUNT", value: 199 })),
    ).toBe(199);
  });

  it("takes a percentage off, rounded down to the cent", () => {
    // 15% of $9.99 is 149.85 cents.
    expect(
      promoDiscountInCents(dessert(999, { type: "PERCENTAGE", value: 15 })),
    ).toBe(149);
  });
});
