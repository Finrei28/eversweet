import { Status } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  orderStatusLabel,
  statusChangeNotice,
  statusChoices,
} from "./orderStatus";

describe("orderStatusLabel", () => {
  it("names the statuses a kitchen tablet sets in Chinese", () => {
    // Both were 已取货 (picked up): the admin tables knew only four statuses.
    expect(orderStatusLabel("ACCEPTED", "zh")).toBe("已接单");
    expect(orderStatusLabel("MAKING", "zh")).toBe("制作中");
  });

  it("keeps the Chinese for the statuses it already named", () => {
    expect(orderStatusLabel("PENDING", "zh")).toBe("待处理");
    expect(orderStatusLabel("READY", "zh")).toBe("已完成");
    expect(orderStatusLabel("PICKED_UP", "zh")).toBe("已取货");
    expect(orderStatusLabel("CANCELLED", "zh")).toBe("已取消");
  });

  it("gives every status its own Chinese name", () => {
    const names = Object.values(Status).map((s) => orderStatusLabel(s, "zh"));
    expect(new Set(names).size).toBe(names.length);
  });

  it("writes the status itself in English, as the tables always have", () => {
    for (const status of Object.values(Status)) {
      expect(orderStatusLabel(status, "en")).toBe(status);
    }
  });
});

/**
 * What an admin may move an order to from the Orders and Past Orders tables: the tablet's
 * Update Status set, once a tablet has accepted the order (the owner's choice, 2026-11-21).
 */
describe("statusChoices", () => {
  it("offers an accepted order the other three of the tablet's statuses", () => {
    expect(statusChoices("ACCEPTED")).toEqual(["MAKING", "READY", "PICKED_UP"]);
    expect(statusChoices("MAKING")).toEqual(["ACCEPTED", "READY", "PICKED_UP"]);
    expect(statusChoices("READY")).toEqual(["ACCEPTED", "MAKING", "PICKED_UP"]);
  });

  // Collected by mistake, it can go back.
  it("lets a collected order be stepped back", () => {
    expect(statusChoices("PICKED_UP")).toEqual(["ACCEPTED", "MAKING", "READY"]);
  });

  // Accepting prints the receipt on the tablet that accepts; from here, none would print.
  it("offers an order still waiting to be accepted nothing", () => {
    expect(statusChoices("PENDING")).toEqual([]);
  });

  // Final, and the tablets' to make.
  it("offers a cancelled order nothing, and never offers cancelling", () => {
    expect(statusChoices("CANCELLED")).toEqual([]);
    for (const status of Object.values(Status)) {
      expect(statusChoices(status)).not.toContain("CANCELLED");
      expect(statusChoices(status)).not.toContain("PENDING");
    }
  });
});

describe("statusChangeNotice", () => {
  it("says the order has moved", () => {
    expect(
      statusChangeNotice("en", "9101", "PICKED_UP", {
        outcome: "moved",
        status: "PICKED_UP",
      }),
    ).toEqual({ variant: "default", title: "Order #9101 is now PICKED_UP" });
    expect(
      statusChangeNotice("zh", "9101", "PICKED_UP", {
        outcome: "moved",
        status: "PICKED_UP",
      }),
    ).toEqual({ variant: "default", title: "订单 #9101 已改为已取货" });
  });

  // A change that went through and lost its answer, retried: the order is where it was sent.
  it("reads a retry that finds the order already moved as done", () => {
    expect(
      statusChangeNotice("en", "9101", "READY", {
        outcome: "changed",
        status: "READY",
      }),
    ).toEqual({ variant: "default", title: "Order #9101 is now READY" });
  });

  it("says where an order a tablet moved first is now, and that nothing changed", () => {
    const notice = statusChangeNotice("en", "9101", "MAKING", {
      outcome: "changed",
      status: "PICKED_UP",
    });
    expect(notice.variant).toBe("destructive");
    expect(notice.title).toBe("Order #9101 was changed elsewhere");
    expect(notice.description).toContain(
      "It is now PICKED_UP, so nothing was changed.",
    );

    expect(
      statusChangeNotice("zh", "9101", "MAKING", {
        outcome: "changed",
        status: "PICKED_UP",
      }).description,
    ).toContain("现在是已取货，未作更改。");
  });

  it("says a cancelled order can no longer be changed", () => {
    expect(
      statusChangeNotice("en", "9101", "READY", {
        outcome: "changed",
        status: "CANCELLED",
      }),
    ).toEqual({
      variant: "destructive",
      title: "Order #9101 has been cancelled",
      description: "Its status can no longer be changed.",
    });
  });
});
