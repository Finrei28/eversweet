import { describe, expect, it, vi } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

import type { OrderType } from "~/lib/types";
import { GetOrderColumns } from "./orders/columns";
import { GetPastOrderColumns } from "./past-orders/columns";

/**
 * The Orders and Past Orders tables showed `priceInCents` as an order's amount. An app order
 * stores its price before discounts there, and the discount beside it, so every app order
 * with a member price, promotion, offer or points showed more than its customer paid. These
 * render the real column definitions, as the tables do, in both languages.
 */

const current = vi.hoisted(() => ({ language: "en" as "en" | "zh" }));

vi.mock("~/app/components/language", () => ({
  useLanguage: () => ({
    language: current.language,
    toggleLanguage: () => undefined,
  }),
}));
// The status menu's mutation, which these tables wire up but never call here.
vi.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({}),
    order: {
      changeStatus: { useMutation: () => ({ mutate: () => undefined }) },
    },
  },
}));
vi.mock("~/hooks/use-toast", () => ({ toast: () => undefined }));

type Rendered = {
  headers: Record<string, string>;
  rows: Record<string, string>[];
};

const text = (html: string) =>
  html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, "");

/** The text of every header and cell, by column id. */
function renderTable(
  useColumns: () => ColumnDef<OrderType>[],
  data: OrderType[],
  sorting: SortingState = [],
): Rendered {
  function Table() {
    const table = useReactTable({
      data,
      columns: useColumns(),
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      state: { sorting },
    });
    return h(
      "table",
      null,
      h(
        "thead",
        null,
        h(
          "tr",
          null,
          table
            .getFlatHeaders()
            .map((header) =>
              h(
                "th",
                { key: header.id, "data-column": header.column.id },
                flexRender(header.column.columnDef.header, header.getContext()),
              ),
            ),
        ),
      ),
      h(
        "tbody",
        null,
        table.getRowModel().rows.map((row) =>
          h(
            "tr",
            { key: row.id },
            row
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
  const headers: Record<string, string> = {};
  for (const [, id, inner] of html.matchAll(
    /<th data-column="([^"]+)">(.*?)<\/th>/g,
  )) {
    headers[id!] = text(inner!);
  }
  const rows = [...html.matchAll(/<tr>(.*?)<\/tr>/g)]
    .slice(1) // the header row
    .map(([, row]) => {
      const cells: Record<string, string> = {};
      for (const [, id, inner] of row!.matchAll(
        /<td data-column="([^"]+)">(.*?)<\/td>/g,
      )) {
        cells[id!] = text(inner!);
      }
      return cells;
    });
  return { headers, rows };
}

function order(
  tempOrderId: string,
  priceInCents: number,
  discountedAmountInCents: number,
): OrderType {
  return {
    id: `order-${tempOrderId}`,
    tempOrderId,
    priceInCents,
    discountedAmountInCents,
    createdAt: new Date("2026-11-21T01:00:00Z"),
    updatedAt: new Date("2026-11-21T01:00:00Z"),
    customerFirstName: "Mei",
    customerLastName: "Chen",
    customerEmail: "mei@example.com",
    customerPhoneNumber: null,
    completedAt: new Date("2026-11-21T01:20:00Z"),
    pickedUpAt: new Date("2026-11-21T01:30:00Z"),
    cancelledAt: null,
    status: "PICKED_UP",
    desserts: [],
  };
}

// An app order: $24.00 before discounts, $6.00 off, so $18.00 paid.
const appOrder = order("9101", 2400, 600);
// A website order stores what was paid and no discount.
const websiteOrder = order("9102", 1550, 0);

const noDialogs = {
  setCustomerDetailsOpen: () => undefined,
  setOrderDetailsOpen: () => undefined,
};
const tables = {
  Orders: () => GetOrderColumns(noDialogs),
  "Past Orders": () => GetPastOrderColumns(noDialogs),
};

/** The one column that shows money: whichever it is, there must be exactly one. */
function amountColumn(rendered: Rendered): string {
  const ids = Object.keys(rendered.rows[0]!).filter((id) =>
    /^\$\d/.test(rendered.rows[0]![id]!),
  );
  expect(ids).toHaveLength(1);
  return ids[0]!;
}

describe.each(Object.entries(tables))("the %s table", (_, useColumns) => {
  describe.each([
    ["en", "Paid"],
    ["zh", "实付金额"],
  ] as const)("in %s", (language, heading) => {
    const render = (data: OrderType[], sorting?: SortingState) => {
      current.language = language;
      return renderTable(useColumns, data, sorting);
    };

    it("shows what an app order's customer paid, its price less its discounts", () => {
      const rendered = render([appOrder]);
      expect(rendered.rows[0]![amountColumn(rendered)]).toBe("$18.00");
    });

    it("shows a website order at the price it stored", () => {
      const rendered = render([websiteOrder]);
      expect(rendered.rows[0]![amountColumn(rendered)]).toBe("$15.50");
    });

    it("shows nothing paid for an app order paid entirely in points", () => {
      const rendered = render([order("9104", 999, 999)]);
      expect(rendered.rows[0]![amountColumn(rendered)]).toBe("$0.00");
    });

    it(`heads the column "${heading}"`, () => {
      const rendered = render([appOrder]);
      expect(rendered.headers[amountColumn(rendered)]).toBe(heading);
    });
  });
});

describe("the Past Orders table's amount column", () => {
  it("sorts by what was paid, not the price before discounts", () => {
    current.language = "en";
    // $24.00 before $9.00 off is $15.00 paid: less than the website order's $15.50, though
    // its price before discounts is more.
    const discounted = order("9103", 2400, 900);
    const columns = () => GetPastOrderColumns(noDialogs);
    const { rows } = renderTable(
      columns,
      [websiteOrder, discounted],
      [{ id: amountColumn(renderTable(columns, [discounted])), desc: false }],
    );
    expect(rows.map((row) => row.orderNumber)).toEqual(["9103", "9102"]);
  });
});
