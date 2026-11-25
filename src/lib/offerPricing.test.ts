import { describe, expect, it } from "vitest";

import {
  cheapestDessert,
  comboCeiling,
  describeComboCeiling,
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

/**
 * A combo is the third way to price an offer: one price for the set. Exactly one of the three
 * is set, as the CHECK constraint `Offer_exactly_one_price` holds it since
 * 20261125000000_offer_combos.
 */
describe("hasExactlyOnePrice with a combo", () => {
  it("accepts a combo price on its own, free included", () => {
    expect(
      hasExactlyOnePrice({ itemPriceInCents: null, discountAmount: null, comboPriceInCents: 1500 }),
    ).toBe(true);
    expect(
      hasExactlyOnePrice({ itemPriceInCents: null, discountAmount: null, comboPriceInCents: 0 }),
    ).toBe(true);
  });

  it("rejects a combo price beside either of the others", () => {
    expect(
      hasExactlyOnePrice({ itemPriceInCents: 500, discountAmount: null, comboPriceInCents: 1500 }),
    ).toBe(false);
    expect(
      hasExactlyOnePrice({ itemPriceInCents: null, discountAmount: 20, comboPriceInCents: 1500 }),
    ).toBe(false);
  });
});

describe("comboCeiling", () => {
  const desserts = [
    { id: "taro", name: "Taro Mochi Bowl", priceInCents: 1050, categoryId: "mochi" },
    { id: "matcha", name: "Matcha Mochi Bowl", priceInCents: 950, categoryId: "mochi" },
    { id: "mango", name: "Mango Sago", priceInCents: 800, categoryId: "sago" },
  ];
  const categoryName = (id: string) =>
    ({ mochi: "Mochi Series", sago: "Sago Series" })[id] ?? id;

  it("adds up the cheapest dessert each slot can take", () => {
    const ceiling = comboCeiling(
      [
        { dessertId: null, categoryId: "mochi" },
        { dessertId: null, categoryId: "sago" },
      ],
      desserts,
      categoryName,
    );
    expect(ceiling?.totalCents).toBe(1750);
    expect(describeComboCeiling(ceiling!)).toBe(
      "Mochi Series from $9.50 + Sago Series from $8.00 = $17.50",
    );
  });

  it("counts a category twice when two slots name it", () => {
    expect(
      comboCeiling(
        [
          { dessertId: null, categoryId: "sago" },
          { dessertId: null, categoryId: "sago" },
        ],
        desserts,
        categoryName,
      )?.totalCents,
    ).toBe(1600);
  });

  it("names a dessert slot by the dessert, at its own price", () => {
    const ceiling = comboCeiling(
      [
        { dessertId: "taro", categoryId: null },
        { dessertId: null, categoryId: "sago" },
      ],
      desserts,
      categoryName,
    );
    expect(describeComboCeiling(ceiling!)).toBe(
      "Taro Mochi Bowl $10.50 + Sago Series from $8.00 = $18.50",
    );
  });

  /**
   * The Chinese dialog shows the same sum with the Chinese names. It used to keep the
   * English "from" between them: "西米系列 from $8.00". Chinese puts 起 after the price.
   */
  it("writes the sum in Chinese with 起, never the English 'from'", () => {
    const chineseName = (id: string) =>
      ({ mochi: "麻薯系列", sago: "西米系列" })[id] ?? id;
    const ceiling = comboCeiling(
      [
        { dessertId: null, categoryId: "mochi" },
        { dessertId: null, categoryId: "sago" },
        { dessertId: "taro", categoryId: null },
      ],
      desserts.map((dessert) =>
        dessert.id === "taro" ? { ...dessert, name: "芋泥麻薯" } : dessert,
      ),
      chineseName,
    );
    expect(describeComboCeiling(ceiling!, "zh")).toBe(
      "麻薯系列 $9.50 起 + 西米系列 $8.00 起 + 芋泥麻薯 $10.50 = $28.00",
    );
  });

  it("has no answer while a slot names nothing on the menu", () => {
    expect(
      comboCeiling(
        [
          { dessertId: null, categoryId: "mochi" },
          { dessertId: null, categoryId: "empty" },
        ],
        desserts,
        categoryName,
      ),
    ).toBeNull();
    expect(comboCeiling([], desserts, categoryName)).toBeNull();
  });
});
