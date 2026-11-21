import "server-only";

import type { PrismaClient } from "@prisma/client";

import {
  dashboardDay,
  OPEN_ORDER_STATUSES,
  paidInCents,
  type DashboardFigures,
} from "~/lib/dashboard";

/**
 * The admin dashboard's four figures, on the Auckland day `now` falls in.
 *
 * Outside the orders router so it can be tested against the database: Vitest cannot load
 * that router (CLAUDE.md, "Testing a router"). See `dashboard.integration.test.ts`.
 *
 * - **Current orders** match the kitchen app's Upcoming and Current lists together: every
 *   open order due by the end of today, overdue ones included, since an order never
 *   accepted is still the shop's to deal with. A booking for a later day is not current.
 * - **Collected today** goes by `pickedUpAt`, as the kitchen app's Past Orders does, not by
 *   `completedAt`, which an order collected without being marked ready never gets.
 * - **Sales** go by `createdAt`, when the order was placed and paid for, and count what was
 *   paid (`paidInCents`). A cancelled order is not a sale, whatever it was paid.
 */
export const getDashboardFigures = async (
  db: Pick<PrismaClient, "order">,
  now: Date = new Date(),
): Promise<DashboardFigures> => {
  const { start, end } = dashboardDay(now);
  const sums = { priceInCents: true, discountedAmountInCents: true } as const;

  const [currentOrders, collectedToday, today, total] = await Promise.all([
    db.order.count({
      where: {
        status: { in: [...OPEN_ORDER_STATUSES] },
        pickUpTime: { lte: end },
      },
    }),
    db.order.count({
      where: { status: "PICKED_UP", pickedUpAt: { gte: start, lte: end } },
    }),
    db.order.aggregate({
      _sum: sums,
      _count: true,
      where: {
        createdAt: { gte: start, lte: end },
        status: { not: "CANCELLED" },
      },
    }),
    db.order.aggregate({
      _sum: sums,
      _count: true,
      where: { status: { not: "CANCELLED" } },
    }),
  ]);

  return {
    currentOrders,
    collectedToday,
    salesToday: { orders: today._count, paidInCents: paidInCents(today._sum) },
    totalSales: { orders: total._count, paidInCents: paidInCents(total._sum) },
  };
};
