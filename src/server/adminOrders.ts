import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";

import { currentOrdersWhere, OPEN_ORDER_STATUSES } from "~/lib/dashboard";

/**
 * What the admin Orders and Past Orders pages list. Outside the orders router so it can be
 * tested against the database: Vitest cannot load that router (CLAUDE.md, "Testing a
 * router"). See `adminOrders.integration.test.ts`.
 *
 * Between them the two pages hold every order due by tonight, each on exactly one:
 *
 * - **Orders** is every open order due by the end of today, Auckland time, overdue ones
 *   included: what the kitchen tablets show across their Upcoming and Current lists, and
 *   what the dashboard counts as current (`currentOrdersWhere`). It listed PENDING and READY
 *   only, due in the next 15 minutes, so an order a tablet had accepted or started making
 *   was on neither page until it was ready.
 * - **Past Orders** is every order the kitchen has finished with, collected or cancelled, as
 *   the tablets' Past Orders is. It also took in an order made ready more than 12 hours
 *   earlier and never collected, which now stays on Orders until someone collects or
 *   cancels it.
 *
 * A booking for a later day is on neither until its day.
 */

/** A table row: the order and its desserts, with just enough of each to name them. */
const orderRowInclude = {
  desserts: {
    include: {
      dessert: { select: { id: true, name: true, chineseName: true } },
      customisations: { include: { customisation: true } },
    },
  },
} satisfies Prisma.OrderInclude;

export const getCurrentOrders = (
  db: Pick<PrismaClient, "order">,
  now: Date = new Date(),
) =>
  db.order.findMany({
    relationLoadStrategy: "join",
    where: currentOrdersWhere(now),
    orderBy: [
      // The enum's own order, which is the kitchen's: PENDING, ACCEPTED, MAKING, READY.
      { status: "asc" },
      { createdAt: "desc" },
    ],
    include: orderRowInclude,
  });

export const getPastOrders = (
  db: Pick<PrismaClient, "order">,
  // The table filters, sorts and paginates on the client, so this is the size of the
  // window it works over - not a page size.
  limit = 500,
) =>
  db.order.findMany({
    relationLoadStrategy: "join",
    // Bounded: this used to fetch every order ever placed, with two levels of nested
    // includes, on every visit to the page.
    take: limit,
    // Every status that is not open, so no order can fall between the two pages.
    where: { status: { notIn: [...OPEN_ORDER_STATUSES] } },
    // Newest first, so `take` keeps the most recent orders rather than the oldest ones -
    // by when they were placed, which every order has. This was `completedAt`, which an
    // order cancelled before it was ready never gets: Postgres sorts NULL first in
    // descending order, so old cancellations crowded newer orders out of the window
    // (Greptile on #37).
    orderBy: [{ createdAt: "desc" }],
    include: orderRowInclude,
  });
