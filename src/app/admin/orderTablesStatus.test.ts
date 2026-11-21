import { describe, expect, it, vi } from "vitest";
import { createElement as h, type ReactNode } from "react";
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
 * The status column and row menu of the Orders and Past Orders tables, rendered from the real
 * column definitions as the tables do.
 *
 * - The Chinese column called an order a tablet had accepted, or was making, 已取货 (picked
 *   up): it knew four statuses of six.
 * - The menus once moved an order's status by writing it straight to the database, so the
 *   tablets never heard and an order moved here could drop off every tablet's lists. Since
 *   2026-11-21 they move it through the order server, for staff who forgot to on the tablet:
 *   the tablet's Update Status set, on an order a tablet has accepted, from the status the
 *   table shows.
 *
 * Nothing here hydrates, so it renders with the React in node_modules, which TanStack Table
 * and the UI components are built against, as `feedback/data-table.test.ts` does.
 */

const current = vi.hoisted(() => ({
  language: "en" as "en" | "zh",
  mutate: vi.fn(),
  /** Each menu item's click, in the order the items rendered. */
  clicks: [] as (() => void)[],
}));

vi.mock("~/app/components/language", () => ({
  useLanguage: () => ({
    language: current.language,
    toggleLanguage: () => undefined,
  }),
}));
vi.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ order: { invalidate: async () => undefined } }),
    order: {
      changeStatus: {
        useMutation: () => ({ mutate: current.mutate }),
      },
    },
  },
}));
vi.mock("~/hooks/use-toast", () => ({ toast: () => undefined }));
// Radix renders a menu's content only once it is open. Drawn flat, its items can be read.
vi.mock("~/components/ui/dropdown-menu", () => {
  const flat =
    (tag: string, marker?: string) =>
    ({ children }: { children?: ReactNode }) =>
      h(tag, marker ? { [marker]: "" } : null, children);
  return {
    DropdownMenu: flat("div"),
    DropdownMenuTrigger: flat("div"),
    DropdownMenuContent: flat("div"),
    DropdownMenuLabel: flat("div"),
    DropdownMenuSeparator: flat("hr"),
    DropdownMenuItem: ({
      children,
      onClick,
    }: {
      children?: ReactNode;
      onClick?: () => void;
    }) => {
      current.clicks.push(onClick ?? (() => undefined));
      return h("div", { "data-menu-item": "" }, children);
    },
  };
});

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

  const menu = (row: OrderType) => {
    current.clicks = [];
    return [
      ...(renderRow(useColumns, row).actions ?? "").matchAll(
        /<div data-menu-item="">(.*?)<\/div>/g,
      ),
    ].map(([, item]) => text(item!));
  };

  describe.each([
    [
      "en",
      ["View customer details", "View order details"],
      {
        ACCEPTED: "ACCEPTED",
        MAKING: "MAKING",
        READY: "READY",
        PICKED_UP: "PICKED_UP",
      },
    ],
    [
      "zh",
      ["查看顾客详情", "查看订单详情"],
      {
        ACCEPTED: "已接单",
        MAKING: "制作中",
        READY: "已完成",
        PICKED_UP: "已取货",
      },
    ],
  ] as const)("in %s", (language, details, name) => {
    // Accepting prints the receipt on the tablet that accepts, and cancelling is final.
    it.each(["PENDING", "CANCELLED"] as const)(
      "offers a %s order its details and no status change",
      (value) => {
        current.language = language;
        expect(menu(order(value))).toEqual(details);
      },
    );

    it.each([
      ["ACCEPTED", ["MAKING", "READY", "PICKED_UP"]],
      ["MAKING", ["ACCEPTED", "READY", "PICKED_UP"]],
      ["READY", ["ACCEPTED", "MAKING", "PICKED_UP"]],
      ["PICKED_UP", ["ACCEPTED", "MAKING", "READY"]],
    ] as const)(
      "offers a %s order its details, then the tablet's other statuses",
      (value, choices) => {
        current.language = language;
        expect(menu(order(value))).toEqual([
          ...details,
          ...choices.map((choice) => name[choice]),
        ]);
      },
    );
  });

  it("moves an order from the status the table shows", () => {
    current.language = "en";
    current.mutate.mockClear();

    const items = menu(order("READY"));
    current.clicks[items.indexOf("PICKED_UP")]!();

    expect(current.mutate).toHaveBeenCalledTimes(1);
    expect(current.mutate.mock.calls[0]![0]).toEqual({
      orderId: "order-1",
      newStatus: "PICKED_UP",
      expectedStatus: "READY",
    });
  });

  it("changes nothing when an order's details are opened", () => {
    current.language = "en";
    current.mutate.mockClear();

    const items = menu(order("READY"));
    current.clicks[items.indexOf("View order details")]!();
    current.clicks[items.indexOf("View customer details")]!();

    expect(current.mutate).not.toHaveBeenCalled();
  });
});
