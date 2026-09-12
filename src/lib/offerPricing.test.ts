import { describe, expect, it } from "vitest";

import {
  cheapestDessert,
  hasExactlyOnePrice,
  isUnderListPrice,
} from "./offerPricing";

/**
 * The three rules an offer's pricing has to satisfy, pinned here so the schema, the
 * router, the dialog and the CHECK constraints are all reading one definition.
 */
describe("hasExactlyOnePrice", () => {
  it("accepts a fixed price on its own", () => {
    expect(
      hasExactlyOnePrice({ itemPriceInCents: 500, discountAmount: null }),
    ).toBe(true);
  });

  it("accepts a discount on its own", () => {
    expect(
      hasExactlyOnePrice({ itemPriceInCents: null, discountAmount: 20 }),
    ).toBe(true);
  });

  /**
   * The case the whole rule exists for. Both set meant the order server silently ignored
   * the discount, so a row could read "50% off" while every customer paid the fixed
   * price.
   */
  it("rejects both being set", () => {
    expect(
      hasExactlyOnePrice({ itemPriceInCents: 500, discountAmount: 20 }),
    ).toBe(false);
  });

  it("rejects neither being set", () => {
    expect(
      hasExactlyOnePrice({ itemPriceInCents: null, discountAmount: null }),
    ).toBe(false);
  });

  /**
   * A fixed price of 0 is how a free item is expressed and both of the shop's giveaway
   * offers are stored that way. A truthiness check here would read it as "no price set"
   * and then reject the offer for having neither.
   */
  it("counts a fixed price of zero as a price", () => {
    expect(
      hasExactlyOnePrice({ itemPriceInCents: 0, discountAmount: null }),
    ).toBe(true);
    expect(hasExactlyOnePrice({ itemPriceInCents: 0, discountAmount: 20 })).toBe(
      false,
    );
  });
});

describe("cheapestDessert", () => {
  it("has no answer for an empty list", () => {
    expect(cheapestDessert([])).toBeNull();
  });

  it("picks the lowest price, not the first", () => {
    expect(
      cheapestDessert([
        { name: "Mango sago", priceInCents: 1200 },
        { name: "Taro balls", priceInCents: 900 },
        { name: "Grass jelly", priceInCents: 1100 },
      ]),
    ).toEqual({ name: "Taro balls", priceInCents: 900 });
  });

  /**
   * Category-scoped offers are the only kind in production, so this is the branch that
   * actually decides the ceiling: beating the cheapest item is what makes the offer a
   * discount on everything it covers rather than only on the expensive things.
   */
  it("keeps the first of equally cheap items", () => {
    expect(
      cheapestDessert([
        { name: "First", priceInCents: 900 },
        { name: "Second", priceInCents: 900 },
      ]),
    ).toEqual({ name: "First", priceInCents: 900 });
  });
});

describe("isUnderListPrice", () => {
  it("passes below the ceiling", () => {
    expect(isUnderListPrice(899, 900)).toBe(true);
  });

  // Equal is not an offer, which is why this is `<` and not `<=`.
  it("fails at the ceiling", () => {
    expect(isUnderListPrice(900, 900)).toBe(false);
  });

  it("fails above the ceiling", () => {
    expect(isUnderListPrice(901, 900)).toBe(false);
  });

  it("lets free through", () => {
    expect(isUnderListPrice(0, 900)).toBe(true);
  });

  // No dessert and no category, or an empty category: there is nothing to undercut, and
  // a rule that cannot be evaluated is not a rule that was broken.
  it("passes when there is nothing to compare against", () => {
    expect(isUnderListPrice(5000, null)).toBe(true);
  });
});
