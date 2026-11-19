import { describe, expect, it } from "vitest";

import {
  customisationPrefix,
  linePrices,
  ORDER_PAGE_LIFETIME_MS,
  orderPageState,
} from "./orderDisplay";

/**
 * What the order page decides before it draws anything: which of its four states to show,
 * and what each line of the receipt costs. Both were worked out inline in the page, so the
 * restyle could only be checked by eye; moved out unchanged, they are pinned here.
 */
describe("orderPageState", () => {
  const now = new Date("2026-11-20T06:00:00Z").getTime();
  const placed = (msAgo: number, status = "PENDING") => ({
    status,
    createdAt: new Date(now - msAgo),
  });

  it("shows the receipt for an order placed within the day", () => {
    expect(orderPageState(placed(60_000), false, now)).toBe("confirmed");
    expect(orderPageState(placed(60_000, "READY"), false, now)).toBe(
      "confirmed",
    );
  });

  it("says an order the shop cancelled is cancelled, however old it is", () => {
    const threeDays = 3 * ORDER_PAGE_LIFETIME_MS;
    expect(orderPageState(placed(threeDays, "CANCELLED"), false, now)).toBe(
      "cancelled",
    );
  });

  it("says a collected order was picked up, however old it is", () => {
    const threeDays = 3 * ORDER_PAGE_LIFETIME_MS;
    expect(orderPageState(placed(threeDays, "PICKED_UP"), false, now)).toBe(
      "picked-up",
    );
  });

  it("keeps the receipt for a whole day and not a moment longer", () => {
    expect(orderPageState(placed(ORDER_PAGE_LIFETIME_MS), false, now)).toBe(
      "confirmed",
    );
    expect(orderPageState(placed(ORDER_PAGE_LIFETIME_MS + 1), false, now)).toBe(
      "not-found",
    );
  });

  it("finds nothing when there is no such order or the read failed", () => {
    expect(orderPageState(null, false, now)).toBe("not-found");
    expect(orderPageState(undefined, true, now)).toBe("not-found");
    expect(orderPageState(placed(60_000), true, now)).toBe("not-found");
  });
});

describe("linePrices", () => {
  const taro = {
    quantity: 1,
    discountedAmountInCents: 0,
    dessert: { priceInCents: 999 },
    customisations: [],
  };

  it("prices a dessert as it is", () => {
    expect(linePrices(taro)).toEqual({ eachInCents: 999, lineInCents: 999 });
  });

  it("adds each topping times its count, and nothing for one taken out", () => {
    expect(
      linePrices({
        ...taro,
        customisations: [
          { quantity: 2, customisation: { priceInCents: 150 } },
          { quantity: 0, customisation: { priceInCents: 100 } },
        ],
      }),
    ).toEqual({ eachInCents: 1299, lineInCents: 1299 });
  });

  it("takes off a promotion's discount", () => {
    expect(linePrices({ ...taro, discountedAmountInCents: 200 })).toEqual({
      eachInCents: 799,
      lineInCents: 799,
    });
  });

  it("multiplies by the quantity, in whole cents", () => {
    expect(
      linePrices({
        ...taro,
        quantity: 3,
        customisations: [{ quantity: 1, customisation: { priceInCents: 150 } }],
      }),
    ).toEqual({ eachInCents: 1149, lineInCents: 3447 });
  });
});

describe("customisationPrefix", () => {
  it("marks a topping added, with its count past one, and one taken out", () => {
    expect(customisationPrefix(1)).toBe("+");
    expect(customisationPrefix(2)).toBe("+ 2");
    expect(customisationPrefix(0)).toBe("-");
  });
});
