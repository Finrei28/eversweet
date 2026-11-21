import { describe, expect, it, vi } from "vitest";
import { createElement as h, type ReactNode } from "react";
import { renderToString } from "react-dom/server";

import type { OrderType } from "~/lib/types";

/**
 * The Orders and Past Orders tables around their rows: the search box, the empty table, the
 * page buttons, the row menu's heading and the ⋯ button's name for a screen reader. Each was
 * English on the Chinese page. The wording is the owner's (2026-11-22), following the other
 * admin tables: 按…搜索 for search, 暂无… for an empty table, 行动 for the menu heading.
 *
 * Nothing here hydrates, so it renders with the React in node_modules, which TanStack Table
 * and the UI components are built against, as `feedback/data-table.test.ts` does.
 */

const current = vi.hoisted(() => ({
  language: "en" as "en" | "zh",
  rows: [] as unknown[],
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
      getAllCurrentOrders: { useSuspenseQuery: () => [current.rows] },
      getAllPastOrders: { useSuspenseQuery: () => [current.rows] },
      changeStatus: { useMutation: () => ({ mutate: () => undefined }) },
      // The details dialogs, closed.
      getCustomerDetails: { useQuery: () => ({ isLoading: false }) },
      getOrderDetails: { useQuery: () => ({ isLoading: false }) },
    },
  },
}));
vi.mock("~/hooks/use-toast", () => ({ toast: () => undefined }));
// Radix renders a menu's content only once it is open. Drawn flat, its heading can be read.
vi.mock("~/components/ui/dropdown-menu", () => {
  const flat =
    (tag: string, marker?: string) =>
    ({ children }: { children?: ReactNode }) =>
      h(tag, marker ? { [marker]: "" } : null, children);
  return {
    DropdownMenu: flat("div"),
    DropdownMenuTrigger: flat("div"),
    DropdownMenuContent: flat("div"),
    DropdownMenuLabel: flat("div", "data-menu-label"),
    DropdownMenuSeparator: flat("hr"),
    DropdownMenuItem: flat("div", "data-menu-item"),
  };
});

import { DataTable as OrdersTable } from "./orders/data-table";
import { DataTable as PastOrdersTable } from "./past-orders/data-table";

const order: OrderType & { discountedAmountInCents: number } = {
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
  status: "PENDING",
  desserts: [],
};

const render = (
  Table: () => ReactNode,
  language: "en" | "zh",
  rows: unknown[],
) => {
  current.language = language;
  current.rows = rows;
  return renderToString(h(Table));
};

const text = (html: string) =>
  html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ");

const placeholder = (html: string) => /placeholder="([^"]*)"/.exec(html)?.[1];
const buttons = (html: string) =>
  [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)]
    .map(([, inner]) => text(inner!).trim())
    .filter(Boolean);
const menuLabel = (html: string) =>
  /<div data-menu-label="">(.*?)<\/div>/.exec(html)?.[1];
const screenReader = (html: string) =>
  /<span class="sr-only">(.*?)<\/span>/.exec(html)?.[1];

describe.each([
  ["Orders", OrdersTable, "No new orders.", "暂无新订单。"],
  ["Past Orders", PastOrdersTable, "No results.", "暂无结果。"],
] as const)("the %s table", (_, Table, emptyEn, emptyZh) => {
  describe("in Chinese", () => {
    it("asks for a customer or order number in Chinese", () => {
      expect(placeholder(render(Table, "zh", [order]))).toBe(
        "按顾客或订单号搜索",
      );
    });

    it("names the page buttons in Chinese", () => {
      expect(buttons(render(Table, "zh", [order]))).toEqual(
        expect.arrayContaining(["上一页", "下一页"]),
      );
    });

    it("heads the row menu 行动 and names its button for a screen reader", () => {
      const html = render(Table, "zh", [order]);
      expect(menuLabel(html)).toBe("行动");
      expect(screenReader(html)).toBe("打开菜单");
    });

    it("says the table is empty in Chinese", () => {
      expect(text(render(Table, "zh", []))).toContain(emptyZh);
    });

    it("leaves none of the English behind", () => {
      for (const html of [
        render(Table, "zh", [order]),
        render(Table, "zh", []),
      ]) {
        for (const english of [
          "Search by",
          "Previous",
          "Next",
          "Action",
          "Open menu",
          emptyEn,
        ]) {
          expect(html).not.toContain(english);
        }
      }
    });
  });

  describe("in English", () => {
    it("keeps its English, with order number in lower case", () => {
      const html = render(Table, "en", [order]);
      expect(placeholder(html)).toBe("Search by customer or order number");
      expect(buttons(html)).toEqual(
        expect.arrayContaining(["Previous", "Next"]),
      );
      expect(menuLabel(html)).toBe("Action");
      expect(screenReader(html)).toBe("Open menu");
      expect(text(render(Table, "en", []))).toContain(emptyEn);
    });
  });
});
