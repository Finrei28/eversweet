import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Status } from "@prisma/client";

import { db } from "~/server/db";
import { describeIfDb, resetDatabase } from "~/test/db";
import { getCurrentOrders, getPastOrders } from "./adminOrders";
import { getDashboardFigures } from "./dashboard";

/**
 * What the admin Orders and Past Orders pages list, against the test database.
 *
 * - **Orders** is every open order due by the end of today in Auckland, overdue ones
 *   included, whatever the kitchen has done with it: the orders the dashboard counts as
 *   current. It listed PENDING and READY only, due in the next 15 minutes, so an order a
 *   tablet had accepted or was making was on neither page.
 * - **Past Orders** is every collected or cancelled order. It also took in an order made
 *   ready more than 12 hours ago and never collected.
 */

// 12:30 PM on Saturday 21 November 2026 in Auckland (NZDT). The UTC date is still Friday
// the 20th, which is what a server's own clock reads on Vercel.
const NOW = new Date("2026-11-20T23:30:00Z");
const nz = (isoLocal: string) => new Date(`${isoLocal}+13:00`);

const order = (
  tempOrderId: string,
  fields: {
    status: Status;
    createdAt?: Date;
    pickUpTime?: Date;
    completedAt?: Date | null;
    pickedUpAt?: Date | null;
    cancelledAt?: Date | null;
  },
) =>
  db.order.create({
    data: {
      tempOrderId,
      customerFirstName: "Aroha",
      customerLastName: "Ngata",
      customerEmail: "aroha@example.com",
      GST: 0,
      priceInCents: 1000,
      createdAt: nz("2026-11-21T12:00:00"),
      pickUpTime: nz("2026-11-21T12:40:00"),
      ...fields,
    },
  });

const current = async () =>
  (await getCurrentOrders(db, NOW)).map((o) => o.tempOrderId).sort();
const past = async () =>
  (await getPastOrders(db)).map((o) => o.tempOrderId).sort();

describeIfDb("the admin order pages", { timeout: 30_000 }, () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("lists an order on Orders whatever the kitchen has done with it", async () => {
    await order("1-pending", { status: "PENDING" });
    await order("2-accepted", { status: "ACCEPTED" });
    await order("3-making", { status: "MAKING" });
    await order("4-ready", {
      status: "READY",
      completedAt: nz("2026-11-21T12:20:00"),
    });

    expect(await current()).toEqual([
      "1-pending",
      "2-accepted",
      "3-making",
      "4-ready",
    ]);
  });

  it("lists orders due any time today, not just in the next 15 minutes", async () => {
    await order("1-this-evening", {
      status: "PENDING",
      pickUpTime: nz("2026-11-21T19:00:00"),
    });
    await order("2-accepted-this-evening", {
      status: "ACCEPTED",
      pickUpTime: nz("2026-11-21T19:00:00"),
    });

    expect(await current()).toEqual([
      "1-this-evening",
      "2-accepted-this-evening",
    ]);
  });

  it("ends today at Auckland midnight, not the server's", async () => {
    await order("1-tonight", {
      status: "PENDING",
      pickUpTime: nz("2026-11-21T23:30:00"),
    });
    // Tomorrow in Auckland, though still Saturday in UTC.
    await order("2-tomorrow", {
      status: "PENDING",
      pickUpTime: nz("2026-11-22T00:30:00"),
    });
    await order("3-tomorrow-lunch", {
      status: "ACCEPTED",
      pickUpTime: nz("2026-11-22T12:30:00"),
    });

    expect(await current()).toEqual(["1-tonight"]);
  });

  it("keeps an overdue order on Orders until someone collects or cancels it", async () => {
    // Due yesterday and never accepted.
    await order("1-never-accepted", {
      status: "PENDING",
      createdAt: nz("2026-11-20T18:00:00"),
      pickUpTime: nz("2026-11-20T19:00:00"),
    });
    // Made ready yesterday evening, 17 hours ago, and never collected.
    await order("2-never-collected", {
      status: "READY",
      createdAt: nz("2026-11-20T18:00:00"),
      pickUpTime: nz("2026-11-20T19:30:00"),
      completedAt: nz("2026-11-20T19:25:00"),
    });

    expect(await current()).toEqual(["1-never-accepted", "2-never-collected"]);
    expect(await past()).toEqual([]);
  });

  it("lists collected and cancelled orders on Past Orders, and only those", async () => {
    await order("1-collected", {
      status: "PICKED_UP",
      completedAt: nz("2026-11-21T12:15:00"),
      pickedUpAt: nz("2026-11-21T12:20:00"),
    });
    // Collected without ever being marked ready.
    await order("2-collected-unmarked", {
      status: "PICKED_UP",
      pickedUpAt: nz("2026-11-21T12:25:00"),
    });
    await order("3-cancelled", {
      status: "CANCELLED",
      cancelledAt: nz("2026-11-21T12:05:00"),
    });
    await order("4-ready", {
      status: "READY",
      completedAt: nz("2026-11-21T12:20:00"),
    });
    await order("5-making", { status: "MAKING" });

    expect(await past()).toEqual([
      "1-collected",
      "2-collected-unmarked",
      "3-cancelled",
    ]);
  });

  it("puts every order due by tonight on exactly one of the two pages", async () => {
    const statuses: Status[] = [
      "PENDING",
      "ACCEPTED",
      "MAKING",
      "READY",
      "PICKED_UP",
      "CANCELLED",
    ];
    const due = [
      nz("2026-11-19T13:00:00"), // two days ago
      nz("2026-11-21T09:00:00"), // this morning
      nz("2026-11-21T12:40:00"), // in ten minutes
      nz("2026-11-21T21:00:00"), // tonight
    ];
    const ids: string[] = [];
    for (const status of statuses) {
      for (const [index, pickUpTime] of due.entries()) {
        const id = `${status}-${index}`;
        ids.push(id);
        await order(id, {
          status,
          createdAt: new Date(pickUpTime.getTime() - 60 * 60 * 1000),
          pickUpTime,
          // As the order server leaves them: ready time from READY on, collection and
          // cancellation times on the orders that have them.
          completedAt:
            status === "READY" || status === "PICKED_UP"
              ? new Date(pickUpTime.getTime() - 5 * 60 * 1000)
              : null,
          pickedUpAt: status === "PICKED_UP" ? pickUpTime : null,
          cancelledAt: status === "CANCELLED" ? pickUpTime : null,
        });
      }
    }

    const onOrders = await current();
    const onPastOrders = await past();
    expect(onOrders.filter((id) => onPastOrders.includes(id))).toEqual([]);
    expect([...onOrders, ...onPastOrders].sort()).toEqual(ids.sort());
  });

  it("lists as many orders as the dashboard counts as current", async () => {
    await order("1-pending", { status: "PENDING" });
    await order("2-accepted", { status: "ACCEPTED" });
    await order("3-making-tonight", {
      status: "MAKING",
      pickUpTime: nz("2026-11-21T20:00:00"),
    });
    await order("4-ready-yesterday", {
      status: "READY",
      createdAt: nz("2026-11-20T18:00:00"),
      pickUpTime: nz("2026-11-20T19:30:00"),
      completedAt: nz("2026-11-20T19:25:00"),
    });
    await order("5-tomorrow", {
      status: "PENDING",
      pickUpTime: nz("2026-11-22T13:00:00"),
    });

    const { currentOrders } = await getDashboardFigures(db, NOW);
    expect(currentOrders).toBe(4);
    expect(await current()).toHaveLength(currentOrders);
  });
});
