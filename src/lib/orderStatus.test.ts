import { Status } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { orderStatusLabel } from "./orderStatus";

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
