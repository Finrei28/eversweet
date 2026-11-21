import { describe, expect, it, vi } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import type { Status } from "@prisma/client";

import type { OrderType } from "~/lib/types";
import { GetOrderColumns } from "./orders/columns";
import { GetPastOrderColumns } from "./past-orders/columns";

/**
 * The status column of the Orders and Past Orders tables, rendered from the real column
 * definitions as the tables do. The Chinese column called an order a tablet had accepted, or
 * was making, 已取货 (picked up): it knew four statuses of six.
 */

const current = vi.hoisted(() => ({ language: "en" as "en" | "zh" }));

vi.mock("~/app/components/language", () => ({
  useLanguage: () => ({
    language: current.language,
    toggleLanguage: () => undefined,
  }),
}));
vi.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({}),
    order: {
      changeStatus: { useMutation: () => ({ mutate: () => undefined }) },
    },
  },
}));
vi.mock("~/hooks/use-toast", () => ({ toast: () => undefined }));

const text = (html: string) =>
  html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, "");

/** The inner HTML of each of the one row's cells, by column id. */
function renderRow(
  useColumns: () => ColumnDef<OrderType>[],
  row: OrderType,
): Record<string, string> {
  function Table() {
    const table = useReactTable({
      data: [row],
      columns: useColumns(),
      getCoreRowModel: getCoreRowModel(),
    });
    return h(
      "table",
      null,
      h(
        "tbody",
        null,
        table.getRowModel().rows.map((r) =>
          h(
            "tr",
            { key: r.id },
            r
              .getVisibleCells()
              .map((cell) =>
                h(
                  "td",
                  { key: cell.id, "data-column": cell.column.id },
                  flexRender(cell.column.columnDef.cell, cell.getContext()),
                ),
              ),
          ),
        ),
      ),
    );
  }

  const html = renderToString(h(Table));
  const cells: Record<string, string> = {};
  for (const [, id, inner] of html.matchAll(
    /<td data-column="([^"]+)">(.*?)<\/td>/g,
  )) {
    cells[id!] = inner!;
  }
  return cells;
}

// Typed so it fits `OrderType` whether or not that carries `discountedAmountInCents` yet.
function order(status: Status): OrderType {
  const row: OrderType & { discountedAmountInCents: number } = {
    id: "order-1",
    tempOrderId: "9101",
    priceInCents: 1550,
    discountedAmountInCents: 0,
    createdAt: new Date("2026-11-21T01:00:00Z"),
    updatedAt: new Date("2026-11-21T01:00:00Z"),
    customerFirstName: "Mei",
    customerLastName: "Chen",
    customerEmail: "mei@example.com",
    customerPhoneNumber: null,
    completedAt: null,
    pickedUpAt: null,
    cancelledAt: null,
    status,
    desserts: [],
  };
  return row;
}

const noDialogs = {
  setCustomerDetailsOpen: () => undefined,
  setOrderDetailsOpen: () => undefined,
};
const tables = {
  Orders: () => GetOrderColumns(noDialogs),
  "Past Orders": () => GetPastOrderColumns(noDialogs),
};

const chinese: [Status, string][] = [
  ["PENDING", "待处理"],
  ["ACCEPTED", "已接单"],
  ["MAKING", "制作中"],
  ["READY", "已完成"],
  ["PICKED_UP", "已取货"],
  ["CANCELLED", "已取消"],
];

describe.each(Object.entries(tables))("the %s table", (_, useColumns) => {
  const status = (row: OrderType) =>
    text(renderRow(useColumns, row).completed ?? "");

  it.each(chinese)("reads %s as %s in Chinese", (value, label) => {
    current.language = "zh";
    expect(status(order(value))).toBe(label);
  });

  it.each(chinese)("reads %s as itself in English", (value) => {
    current.language = "en";
    expect(status(order(value))).toBe(value);
  });
});
