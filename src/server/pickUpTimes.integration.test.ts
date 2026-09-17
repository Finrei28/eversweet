import { Prisma } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Outside a Next request there is no data cache to write to; read straight through.
vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

import { atNZ } from "~/lib/pickUpTimes";
import { db } from "~/server/db";
import { describeIfDb, resetDatabase } from "~/test/db";
import {
  checkWebsitePickUpTime,
  getDaysOff,
  getTradingCalendar,
  getTradingHours,
} from "./pickUpTimes";

/** The hours the migration seeds. `resetDatabase` truncates them, so each case puts them back. */
const seedHours = () =>
  db.tradingHours.createMany({
    data: [
      { weekday: 0, opensAt: 720, closesAt: 1320 },
      { weekday: 1, opensAt: 750, closesAt: 1290 },
      { weekday: 2, opensAt: 750, closesAt: 1290 },
      { weekday: 3, opensAt: 750, closesAt: 1290 },
      { weekday: 4, opensAt: 750, closesAt: 1290 },
      { weekday: 5, opensAt: 720, closesAt: 1320 },
      { weekday: 6, opensAt: 720, closesAt: 1320 },
    ],
  });

// Thursday 5 March 2026 in Auckland: the shop closes at 9:30 PM, last pick-up 9:20.
const THU = "2026-03-05";
const at = (day: string, time: string) =>
  atNZ(day, Number(time.slice(0, 2)) * 60 + Number(time.slice(3)));

describeIfDb("the website's pick-up time check", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedHours();
  });

  it("reads the week's hours from the table", async () => {
    expect(await getTradingHours()).toEqual([
      { weekday: 0, opensAt: 720, closesAt: 1320 },
      { weekday: 1, opensAt: 750, closesAt: 1290 },
      { weekday: 2, opensAt: 750, closesAt: 1290 },
      { weekday: 3, opensAt: 750, closesAt: 1290 },
      { weekday: 4, opensAt: 750, closesAt: 1290 },
      { weekday: 5, opensAt: 720, closesAt: 1320 },
      { weekday: 6, opensAt: 720, closesAt: 1320 },
    ]);
  });

  /**
   * The admin app stores a day off as Auckland midnight. Filtering from midnight UTC on
   * today's date - 13 hours later - would have dropped today's own day off.
   */
  it("keeps today's own day off", async () => {
    await db.daysOff.create({ data: { date: at(THU, "00:00") } });

    const daysOff = await getDaysOff(at(THU, "14:00"));
    const calendar = await getTradingCalendar(at(THU, "14:00"));

    expect(daysOff).toHaveLength(1);
    expect([...calendar.daysOff]).toEqual([THU]);
  });

  it("accepts the last pick-up and refuses the minute after", async () => {
    const now = at(THU, "20:00");

    expect(await checkWebsitePickUpTime(at(THU, "21:20"), 2, now)).toEqual({
      ok: true,
      serverNow: now,
    });
    expect(await checkWebsitePickUpTime(at(THU, "21:21"), 2, now)).toEqual({
      ok: false,
      reason: "after-last-pick-up",
      asap: at(THU, "20:10"),
      serverNow: now,
    });
  });

  it("offers the next opening when nothing is left today", async () => {
    expect(
      await checkWebsitePickUpTime(at(THU, "21:25"), 2, at(THU, "21:15")),
    ).toEqual({
      ok: false,
      reason: "after-last-pick-up",
      asap: at("2026-03-06", "12:00"),
      serverNow: at(THU, "21:15"),
    });
  });

  it("refuses a time the kitchen cannot make, allowing a few minutes' grace", async () => {
    const now = at(THU, "18:00");

    expect(await checkWebsitePickUpTime(at(THU, "18:06"), 2, now)).toEqual({
      ok: true,
      serverNow: now,
    });
    expect(await checkWebsitePickUpTime(at(THU, "18:04"), 2, now)).toEqual({
      ok: false,
      reason: "too-soon",
      asap: at(THU, "18:10"),
      serverNow: now,
    });
  });

  it("refuses a day off", async () => {
    await db.daysOff.create({ data: { date: at("2026-03-06", "00:00") } });

    expect(
      await checkWebsitePickUpTime(
        at("2026-03-06", "14:00"),
        2,
        at(THU, "18:00"),
      ),
    ).toMatchObject({ ok: false, reason: "closed-day" });
  });

  it("reads a closed weekday from the table", async () => {
    await db.tradingHours.update({
      where: { weekday: 5 },
      data: { opensAt: null, closesAt: null },
    });

    expect(
      await checkWebsitePickUpTime(
        at("2026-03-06", "14:00"),
        2,
        at(THU, "18:00"),
      ),
    ).toMatchObject({ ok: false, reason: "closed-day" });
  });

  // The migration's CHECK constraints, which Prisma cannot see. A test database built with
  // `prisma db push` has none, and the suites promise to pass on one - so these skip, in
  // the report rather than silently, until the constraints are applied (see CLAUDE.md).
  it.for([
    [
      "a weekday outside the week",
      { weekday: 7, opensAt: 720, closesAt: 1320 },
    ],
    [
      "an opening with no closing",
      { weekday: 1, opensAt: 720, closesAt: null },
    ],
    ["a close past midnight", { weekday: 1, opensAt: 720, closesAt: 1441 }],
    ["no time for a last pick-up", { weekday: 1, opensAt: 720, closesAt: 725 }],
  ] as const)("the table refuses %s", async ([, row], { skip }) => {
    const [constraint] = await db.$queryRaw<{ installed: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'TradingHours_weekday_in_week'
      ) AS installed
    `;
    if (!constraint?.installed) skip();

    await db.tradingHours.deleteMany({ where: { weekday: row.weekday } });

    await expect(db.tradingHours.create({ data: row })).rejects.toThrow(
      Prisma.PrismaClientUnknownRequestError,
    );
  });
});
