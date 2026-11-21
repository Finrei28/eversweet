import { describe, expect, it } from "vitest";

import { dashboardDay, OPEN_ORDER_STATUSES, paidInCents } from "./dashboard";

/**
 * The admin dashboard's day and money, without a database.
 *
 * "Today" is the Auckland calendar day, wherever the server runs. The dashboard used
 * `setHours` on the server's own clock, which on Vercel is UTC: in daylight saving its
 * "today" ran from 1 PM to 1 PM Auckland time. The process is UTC in CI too, so these cases
 * fail there on the old code as well as locally.
 */

// 12:30 PM on Saturday 21 November 2026 in Auckland (NZDT, UTC+13), when the UTC date is
// still Friday the 20th.
const SAT_LUNCH = new Date("2026-11-20T23:30:00Z");

describe("dashboardDay", () => {
  it("runs from Auckland midnight to the last millisecond of the Auckland day", () => {
    expect(dashboardDay(SAT_LUNCH)).toEqual({
      start: new Date("2026-11-20T11:00:00.000Z"),
      end: new Date("2026-11-21T10:59:59.999Z"),
    });
  });

  it("is the same Auckland day at either end of it", () => {
    const justAfterMidnight = new Date("2026-11-20T11:00:00.000Z");
    const lastMillisecond = new Date("2026-11-21T10:59:59.999Z");
    expect(dashboardDay(justAfterMidnight)).toEqual(dashboardDay(SAT_LUNCH));
    expect(dashboardDay(lastMillisecond)).toEqual(dashboardDay(SAT_LUNCH));
  });

  it("follows the Auckland clock out of daylight saving too", () => {
    // 9 AM on Wednesday 10 June 2026 in Auckland (NZST, UTC+12).
    expect(dashboardDay(new Date("2026-06-09T21:00:00Z"))).toEqual({
      start: new Date("2026-06-09T12:00:00.000Z"),
      end: new Date("2026-06-10T11:59:59.999Z"),
    });
  });
});

describe("paidInCents", () => {
  it("takes the discounts off, which is what the customer paid", () => {
    // An app order stores its price before discounts and the discount beside it.
    expect(
      paidInCents({ priceInCents: 2000, discountedAmountInCents: 500 }),
    ).toBe(1500);
  });

  it("leaves a website order alone, whose price is already what was paid", () => {
    expect(
      paidInCents({ priceInCents: 1200, discountedAmountInCents: 0 }),
    ).toBe(1200);
  });

  it("is zero when there are no orders to sum", () => {
    expect(
      paidInCents({ priceInCents: null, discountedAmountInCents: null }),
    ).toBe(0);
  });
});

describe("OPEN_ORDER_STATUSES", () => {
  it("is every status the kitchen has not finished with", () => {
    expect([...OPEN_ORDER_STATUSES].sort()).toEqual(
      ["ACCEPTED", "MAKING", "PENDING", "READY"].sort(),
    );
  });
});
