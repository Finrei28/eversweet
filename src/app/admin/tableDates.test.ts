import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { type Feedback } from "@prisma/client";

/**
 * The admin tables render on the server - Vercel, in UTC - and hydrate in a browser that
 * is usually in Auckland. A date written with no zone came out as a different day on each
 * side for anything after Auckland midnight but before UTC's, and React logged a hydration
 * error. These render the real column definitions, as the tables do, with the process in
 * each zone in turn: every one must write the Auckland day.
 */

type LanguageModule = typeof import("~/app/components/language");

/** The text each cell of the one row renders, by column id. */
function renderRow<T>(
  lang: LanguageModule,
  useColumns: () => ColumnDef<T>[],
  row: T,
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

  const html = renderToString(h(lang.LanguageProvider, null, h(Table)));
  const cells: Record<string, string> = {};
  for (const [, id, inner] of html.matchAll(
    /<td data-column="([^"]+)">(.*?)<\/td>/g,
  )) {
    cells[id!] = inner!.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, "");
  }
  return cells;
}

// 1:00 AM on Thursday 1 October 2026 in Auckland (NZDT, UTC+13): still 30 September in UTC
// and in Los Angeles.
const justAfterAucklandMidnight = new Date("2026-09-30T12:00:00Z");

const feedback: Feedback = {
  id: "feedback-1",
  name: "Mei",
  email: "mei@example.com",
  feedbackMessage: "Lovely sago.",
  rating: 5,
  createdAt: justAfterAucklandMidnight,
};

describe.each(["UTC", "America/Los_Angeles", "Pacific/Auckland"])(
  "admin table dates with the process in %s",
  (zone) => {
    const original = process.env.TZ;
    let lang: LanguageModule;
    let feedbackColumns: typeof import("./feedback/columns");

    beforeAll(async () => {
      process.env.TZ = zone;
      // Loaded after the zone is set: a formatter made at module scope takes the zone the
      // process had then.
      vi.resetModules();
      lang = await import("~/app/components/language");
      feedbackColumns = await import("./feedback/columns");
    });
    afterAll(() => {
      process.env.TZ = original;
    });

    it("really is running in that zone", () => {
      const offset = justAfterAucklandMidnight.getTimezoneOffset();
      expect(zone === "UTC" ? offset === 0 : offset !== 0).toBe(true);
    });

    it("dates feedback by the Auckland day it was sent", () => {
      const cells = renderRow(
        lang,
        feedbackColumns.GetPastOrderColumns,
        feedback,
      );
      expect(cells.createdAt).toBe("1/10/2026");
    });
  },
);
