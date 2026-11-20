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

import { endOfDayNZ, startOfDayNZ } from "~/lib/aucklandDay";
import type { WinnerRow } from "./winners/columns";

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

function winner(expiresAt: Date): WinnerRow {
  return {
    id: "winner-1",
    month: 9,
    year: 2026,
    place: 1,
    points: 420,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    user: {
      id: "user-1",
      username: "mei",
      firstName: "Mei",
      lastName: "Lin",
      email: "mei@example.com",
      phone: null,
      anonymousEnabled: false,
    },
    reward: {
      id: "reward-1",
      title: "A free bowl",
      description: null,
      code: "ABCD2345",
      expiresAt,
      assignedAt: new Date("2026-10-01T00:00:00Z"),
      assignedByAdminId: null,
      redeemedAt: null,
      redeemedByAdminId: null,
    },
  };
}

describe.each(["UTC", "America/Los_Angeles", "Pacific/Auckland"])(
  "admin table dates with the process in %s",
  (zone) => {
    const original = process.env.TZ;
    let lang: LanguageModule;
    let feedbackColumns: typeof import("./feedback/columns");
    let winnerColumns: typeof import("./winners/columns");

    beforeAll(async () => {
      process.env.TZ = zone;
      // Loaded after the zone is set: a formatter made at module scope takes the zone the
      // process had then.
      vi.resetModules();
      lang = await import("~/app/components/language");
      feedbackColumns = await import("./feedback/columns");
      winnerColumns = await import("./winners/columns");
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

    const winnerColumnsFor = () =>
      winnerColumns.GetWinnerColumns({ onEditReward: () => undefined });

    it("gives a prize's last day to collect, as this site stores the deadline", () => {
      // The last instant of 31 October in Auckland.
      const cells = renderRow(
        lang,
        winnerColumnsFor,
        winner(endOfDayNZ("2026-10-31")),
      );
      expect(cells.expires).toBe("31/10/2026");
    });

    it("gives the same last day for the staff app's deadline, the next day's first instant", () => {
      // Midnight at the start of 1 November in Auckland: the prize can be collected on 31
      // October and not on 1 November.
      const cells = renderRow(
        lang,
        winnerColumnsFor,
        winner(startOfDayNZ("2026-11-01")),
      );
      expect(cells.expires).toBe("31/10/2026");
    });
  },
);
