import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Status } from "@prisma/client";

import { db } from "~/server/db";
import { describeIfDb, resetDatabase } from "~/test/db";
import { getDashboardFigures } from "./dashboard";

/**
 * The admin dashboard's four figures, against the test database.
 *
 * - **Current orders** are every order not collected or cancelled that is due today or
 *   overdue: what the kitchen app shows across its Upcoming and Current lists. The
 *   dashboard counted PENDING alone, of any day, so an order the kitchen had accepted
 *   dropped out and a booking for next week counted.
 * - **Collected today** is orders picked up today, by when they were picked up. The
 *   dashboard counted every order ever marked ready.
 * - **Sales** are what customers paid: the price less the discount. An app order stores
 *   its price before discounts and the discount beside it; a website order stores the
 *   price paid and no discount. The dashboard summed the price alone.
 * - **"Today" is the Auckland day.** The dashboard took it from the server's clock, which
 *   on Vercel is UTC.
 */

// 12:30 PM on Saturday 21 November 2026 in Auckland (NZDT), half an hour after opening.
// The UTC date is still Friday the 20th, which is what the server's own clock reads.
const NOW = new Date("2026-11-20T23:30:00Z");
const nz = (isoLocal: string) => new Date(`${isoLocal}+13:00`);

let counter = 0;
const order = (fields: {
  status: Status;
  createdAt?: Date;
  pickUpTime?: Date;
  pickedUpAt?: Date | null;
  completedAt?: Date | null;
  priceInCents?: number;
  discountedAmountInCents?: number;
}) =>
  db.order.create({
    data: {
      tempOrderId: String(++counter),
      customerFirstName: "Aroha",
      customerLastName: "Ngata",
      customerEmail: "aroha@example.com",
      GST: 0,
      priceInCents: 1000,
      createdAt: nz("2026-11-21T12:00:00"),
      pickUpTime: nz("2026-11-21T13:00:00"),
      ...fields,
    },
  });

describeIfDb("getDashboardFigures", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("counts open orders due today or overdue, whatever the kitchen has done with them", async () => {
    await order({ status: "PENDING" });
    await order({ status: "ACCEPTED" });
    await order({ status: "MAKING" });
    await order({ status: "READY", completedAt: nz("2026-11-21T12:20:00") });
    // Due yesterday and never accepted: still the shop's to deal with.
    await order({
      status: "PENDING",
      createdAt: nz("2026-11-20T19:00:00"),
      pickUpTime: nz("2026-11-20T20:00:00"),
    });
    // Not current: a booking for tomorrow, one collected, one cancelled.
    await order({ status: "PENDING", pickUpTime: nz("2026-11-22T13:00:00") });
    await order({ status: "ACCEPTED", pickUpTime: nz("2026-11-22T13:00:00") });
    await order({ status: "PICKED_UP", pickedUpAt: nz("2026-11-21T12:10:00") });
    await order({ status: "CANCELLED" });

    expect((await getDashboardFigures(db, NOW)).currentOrders).toBe(5);
  });

  it("counts orders collected today in Auckland, by when they were collected", async () => {
    // Ready at 12:05 and collected at 12:10 PM today, which is still yesterday on the
    // server's UTC clock.
    await order({
      status: "PICKED_UP",
      completedAt: nz("2026-11-21T12:05:00"),
      pickedUpAt: nz("2026-11-21T12:10:00"),
    });
    // Collected without being marked ready first, so it has no ready time.
    await order({
      status: "PICKED_UP",
      pickedUpAt: nz("2026-11-21T12:25:00"),
      completedAt: null,
    });
    // Not collected today: yesterday evening, or ready but still waiting.
    await order({
      status: "PICKED_UP",
      createdAt: nz("2026-11-20T19:00:00"),
      pickedUpAt: nz("2026-11-20T21:00:00"),
      completedAt: nz("2026-11-20T20:50:00"),
    });
    await order({ status: "READY", completedAt: nz("2026-11-21T12:20:00") });

    expect((await getDashboardFigures(db, NOW)).collectedToday).toBe(2);
  });

  it("totals today's sales from Auckland midnight, so yesterday evening is not today", async () => {
    await order({ status: "PICKED_UP", createdAt: nz("2026-11-21T12:05:00") });
    await order({ status: "PENDING", createdAt: nz("2026-11-21T12:25:00") });
    // Yesterday at 9 PM, which falls on the same UTC date as today's lunchtime.
    await order({ status: "PICKED_UP", createdAt: nz("2026-11-20T21:00:00") });
    // Cancelled today: not a sale.
    await order({ status: "CANCELLED", createdAt: nz("2026-11-21T12:15:00") });

    expect((await getDashboardFigures(db, NOW)).salesToday).toEqual({
      orders: 2,
      paidInCents: 2000,
    });
  });

  it("counts sales at what customers paid, after discounts", async () => {
    // An app order: $20.00 before a $5.00 discount.
    await order({
      status: "PICKED_UP",
      priceInCents: 2000,
      discountedAmountInCents: 500,
    });
    // A website order stores what was paid, with no discount beside it.
    await order({ status: "PENDING", priceInCents: 1200 });
    // Paid entirely in points: nothing was paid.
    await order({
      status: "PICKED_UP",
      priceInCents: 800,
      discountedAmountInCents: 800,
    });

    const figures = await getDashboardFigures(db, NOW);
    expect(figures.salesToday).toEqual({ orders: 3, paidInCents: 2700 });
    expect(figures.totalSales).toEqual({ orders: 3, paidInCents: 2700 });
  });

  it("totals every day's sales, after discounts, leaving out cancelled orders", async () => {
    await order({
      status: "PICKED_UP",
      createdAt: nz("2026-10-01T15:00:00"),
      priceInCents: 3000,
      discountedAmountInCents: 1000,
    });
    await order({ status: "PENDING", priceInCents: 1500 });
    await order({
      status: "CANCELLED",
      createdAt: nz("2026-11-01T15:00:00"),
      priceInCents: 9900,
    });

    expect((await getDashboardFigures(db, NOW)).totalSales).toEqual({
      orders: 2,
      paidInCents: 3500,
    });
  });

  it("answers zero for an empty shop", async () => {
    expect(await getDashboardFigures(db, NOW)).toEqual({
      currentOrders: 0,
      collectedToday: 0,
      salesToday: { orders: 0, paidInCents: 0 },
      totalSales: { orders: 0, paidInCents: 0 },
    });
  });
});
