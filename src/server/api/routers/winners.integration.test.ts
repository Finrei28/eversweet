/**
 * Reading monthly winners, against a real Postgres.
 *
 * `getWinners` is the one procedure in the winner router that still touches the database
 * from this site. Assigning a prize and settling a month moved to the order server, which
 * mints the code, notifies the winner and holds the guards; their tests live there
 * (`prizeRedemption.integration.test.ts`, `monthlyWinners.integration.test.ts`), and the
 * requests this site sends are pinned in `winners.test.ts`.
 *
 * Skips when TEST_DATABASE_URL is unset; see `src/test/db.ts`.
 */
import { beforeEach, expect, it, vi } from "vitest";

// `trpc.ts` imports `~/server/auth` -> next-auth -> `next/server`, which will not resolve
// under Vitest, and the router imports `orderServer`, which is `server-only`. A server-side
// caller never calls `auth()`, so both stubs cost nothing.
vi.mock("server-only", () => ({}));
vi.mock("~/server/auth", () => ({ auth: vi.fn(async () => null) }));

import { db } from "~/server/db";
import { adminCaller } from "~/test/caller";
import { describeIfDb, resetDatabase } from "~/test/db";

let people = 0;
const seedUser = () =>
  db.user.create({
    data: {
      email: `winner${++people}@eversweet.test`,
      password: "not-a-real-hash",
      role: "USER",
      firstName: "Mei",
      lastName: "Chen",
    },
  });

const seedWinner = async ({
  month = 9,
  year = 2026,
  place = 1,
  points = 420,
}: {
  month?: number;
  year?: number;
  place?: number;
  points?: number;
} = {}) => {
  const user = await seedUser();
  return db.loyaltyWinner.create({
    data: { userId: user.id, month, year, place, points },
    select: { id: true },
  });
};

/** See the note in `offers.integration.test.ts`: `timingMiddleware` sleeps on every call. */
describeIfDb("winner router", { timeout: 30_000 }, () => {
  beforeEach(async () => {
    await resetDatabase();
    people = 0;
  });

  it("lists winners newest month first, places in order, with the prize attached", async () => {
    const august = await seedWinner({ month: 8, place: 1 });
    const septemberFirst = await seedWinner({ month: 9, place: 1 });
    const septemberSecond = await seedWinner({ month: 9, place: 2 });

    // Written directly: this site no longer writes rewards, so the fixture stands in for
    // what the order server would have stored.
    await db.winnerReward.create({
      data: {
        winnerId: septemberFirst.id,
        title: "One free dessert",
        code: "ABCD2345",
        expiresAt: new Date("2026-10-31T10:59:59.999Z"),
      },
    });

    const winners = await adminCaller().winner.getWinners();

    expect(winners.map((w) => w.id)).toEqual([
      septemberFirst.id,
      septemberSecond.id,
      august.id,
    ]);

    expect(winners[0]).toMatchObject({
      month: 9,
      year: 2026,
      place: 1,
      points: 420,
      user: { firstName: "Mei", lastName: "Chen" },
      reward: { title: "One free dessert", code: "ABCD2345" },
    });

    // Unassigned reads as absent, which is what `rewardStatus` turns into "UNASSIGNED".
    expect(winners[1]?.reward).toBeNull();
  });
});
