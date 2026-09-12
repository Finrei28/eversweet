/**
 * Assigning a monthly winner their prize, against a real Postgres.
 *
 * What is worth proving here is everything the procedure refuses to do. `upsertReward`
 * mints a code that a staff member later types in at the counter, and the guarantees
 * around it are all about what must *not* change: the code is stable across an edit, the
 * original assigner is recorded once, and a prize already handed over cannot be rewritten
 * afterwards. None of that is visible from the admin table, and all of it is a statement
 * about rows.
 *
 * Redemption is deliberately untestable from here - no procedure in this repo writes
 * `redeemedAt`, and `upsertRewardSchema` has no shape that could. The admin *mobile* app
 * does that.
 *
 * Skips when TEST_DATABASE_URL is unset; see `src/test/db.ts`.
 */
import { DateTime } from "luxon";
import { beforeEach, expect, it, vi } from "vitest";

// `rewardCode` is `server-only`, which throws outside an RSC, and `trpc.ts` imports
// `~/server/auth` -> next-auth -> `next/server`, which will not resolve under Vitest. A
// server-side caller never calls `auth()`, so the stub costs nothing.
vi.mock("server-only", () => ({}));
vi.mock("~/server/auth", () => ({ auth: vi.fn(async () => null) }));

import { db } from "~/server/db";
import { REWARD_CODE_ALPHABET, REWARD_CODE_LENGTH } from "~/server/rewardCode";
import { ADMIN_ID, adminCaller } from "~/test/caller";
import { describeIfDb, resetDatabase } from "~/test/db";

const ZONE = "Pacific/Auckland";

/** The clock-face date an admin picks in the calendar: local midnight, as the browser hands it over. */
const OCTOBER_31 = new Date(2026, 9, 31);

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
  withUser = true,
}: {
  month?: number;
  year?: number;
  place?: number;
  points?: number;
  withUser?: boolean;
} = {}) => {
  const user = withUser ? await seedUser() : null;
  return db.loyaltyWinner.create({
    data: { userId: user?.id ?? null, month, year, place, points },
    select: { id: true, userId: true },
  });
};

/** See the note in `offers.integration.test.ts`: `timingMiddleware` sleeps on every call. */
describeIfDb("winner router", { timeout: 30_000 }, () => {
  beforeEach(async () => {
    await resetDatabase();
    people = 0;
  });

  it("mints a readable code and records who assigned it", async () => {
    const winner = await seedWinner();

    const reward = await adminCaller().winner.upsertReward({
      winnerId: winner.id,
      title: "One free dessert",
      description: "Any bowl up to $12",
      expiresAt: OCTOBER_31,
    });

    expect(reward.title).toBe("One free dessert");
    expect(reward.description).toBe("Any bowl up to $12");
    expect(reward.assignedByAdminId).toBe(ADMIN_ID);

    // Nothing on this website can mark a prize collected.
    expect(reward.redeemedAt).toBeNull();
    expect(reward.redeemedByAdminId).toBeNull();

    expect(reward.code).toHaveLength(REWARD_CODE_LENGTH);
    // Read aloud across a counter, so 0/O, 1/I/L and U/V are all excluded. A stray
    // character here means the generator and the alphabet have drifted apart.
    expect(
      [...reward.code].filter((c) => !REWARD_CODE_ALPHABET.includes(c)),
    ).toEqual([]);
  });

  it("pins the expiry to the last instant of the chosen Auckland day", async () => {
    const winner = await seedWinner();

    const reward = await adminCaller().winner.upsertReward({
      winnerId: winner.id,
      title: "One free dessert",
      expiresAt: OCTOBER_31,
    });

    // The calendar hands over midnight in the browser's timezone. Taken at face value
    // that is a code which dies at the *start* of the chosen day; the server re-anchors
    // the clock-face date in Auckland, so the answer does not depend on the device that
    // assigned it or the one running this test.
    expect(
      DateTime.fromJSDate(reward.expiresAt)
        .setZone(ZONE)
        .toFormat("yyyy-LL-dd HH:mm:ss.SSS"),
    ).toBe("2026-10-31 23:59:59.999");
  });

  it("keeps the code and the original assigner when the prize is edited", async () => {
    const winner = await seedWinner();

    const first = await adminCaller().winner.upsertReward({
      winnerId: winner.id,
      title: "One free dessert",
      description: "Any bowl up to $12",
      expiresAt: OCTOBER_31,
    });

    // A different admin edits it. assignedBy records who first granted the prize, so it
    // must not follow whoever touched it last.
    const edited = await adminCaller("second-admin").winner.upsertReward({
      winnerId: winner.id,
      title: "Two free desserts",
      expiresAt: new Date(2026, 10, 30),
    });

    // The winner is already looking at this code in the app.
    expect(edited.code).toBe(first.code);
    expect(edited.assignedByAdminId).toBe(ADMIN_ID);
    expect(edited.assignedAt).toEqual(first.assignedAt);
    expect(edited.id).toBe(first.id);

    expect(edited.title).toBe("Two free desserts");
    // Omitted rather than blanked, and still cleared: the router maps undefined to null.
    expect(edited.description).toBeNull();

    // Upsert, not insert-again.
    await expect(db.winnerReward.count()).resolves.toBe(1);
  });

  it("refuses a winner whose account has been closed", async () => {
    const winner = await seedWinner({ withUser: false });

    await expect(
      adminCaller().winner.upsertReward({
        winnerId: winner.id,
        title: "One free dessert",
        expiresAt: OCTOBER_31,
      }),
    ).rejects.toThrow(/account has been closed/);

    await expect(db.winnerReward.count()).resolves.toBe(0);
  });

  it("refuses to change a prize that has already been handed over", async () => {
    const winner = await seedWinner();
    const caller = adminCaller();

    await caller.winner.upsertReward({
      winnerId: winner.id,
      title: "One free dessert",
      expiresAt: OCTOBER_31,
    });

    // What the admin mobile app does at the counter.
    await db.winnerReward.update({
      where: { winnerId: winner.id },
      data: { redeemedAt: new Date(), redeemedByAdminId: "counter-admin" },
    });

    await expect(
      caller.winner.upsertReward({
        winnerId: winner.id,
        title: "Actually, two free desserts",
        expiresAt: OCTOBER_31,
      }),
    ).rejects.toThrow(/already been redeemed/);

    // Editing the title now would rewrite what happened.
    await expect(
      db.winnerReward.findUnique({
        where: { winnerId: winner.id },
        select: { title: true },
      }),
    ).resolves.toEqual({ title: "One free dessert" });
  });

  it("refuses a winner that does not exist", async () => {
    await expect(
      adminCaller().winner.upsertReward({
        winnerId: "no-such-winner",
        title: "One free dessert",
        expiresAt: OCTOBER_31,
      }),
    ).rejects.toThrow(/Winner not found/);
  });

  it("lists winners newest month first, places in order, with the prize attached", async () => {
    const august = await seedWinner({ month: 8, place: 1 });
    const septemberFirst = await seedWinner({ month: 9, place: 1 });
    const septemberSecond = await seedWinner({ month: 9, place: 2 });

    const caller = adminCaller();
    await caller.winner.upsertReward({
      winnerId: septemberFirst.id,
      title: "One free dessert",
      expiresAt: OCTOBER_31,
    });

    const winners = await caller.winner.getWinners();

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
      reward: { title: "One free dessert" },
    });

    // Unassigned reads as absent, which is what `rewardStatus` turns into "UNASSIGNED".
    expect(winners[1]?.reward).toBeNull();
  });
});
