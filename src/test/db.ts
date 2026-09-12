import { describe } from "vitest";

import { db } from "~/server/db";

/**
 * Integration tests for the admin write paths need a real Postgres: what they prove —
 * that `updateOffer` patches an `OfferRequirement` in place rather than recreating it,
 * that `upsertReward` keeps a code stable across an edit — is the database's behaviour
 * and the diff logic acting on it. A mock would only assert that the mock was called.
 *
 * When TEST_DATABASE_URL is absent these suites skip rather than fail, so `npm test`
 * still runs the unit suites for anyone without a database to hand.
 *
 * The local cluster is the standalone PG16 at C:\pg16test, shared with the order server
 * but in a **separate database** — both suites truncate, so one database would have them
 * clearing each other's rows.
 */
export const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

export const describeIfDb = hasTestDatabase ? describe : describe.skip;

/**
 * Empties every table. Cheaper and more thorough than unwinding fixtures.
 *
 * Guarded on the database name, because `DATABASE_URL` in this repo is production
 * Supabase and the mistake this prevents is unrecoverable — it is the 2026-09-11
 * incident in `RECOVERY.md` arriving from a different direction. `vitest.config.mts`
 * decides the URL at config time so it cannot be production; this is the second,
 * independent guard, because only one of them has to be wrong.
 */
export const resetDatabase = async () => {
  const url = process.env.DATABASE_URL ?? "";
  const databaseName = url.split("/").pop()?.split("?")[0] ?? "";

  if (!/test/i.test(databaseName)) {
    throw new Error(
      `Refusing to truncate "${databaseName}": the test database's name must ` +
        `contain "test". DATABASE_URL is production in this repo — check that ` +
        `TEST_DATABASE_URL is set and that vitest.config.mts swapped it in.`,
    );
  }

  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;

  const targets = tables
    .map((t) => t.tablename)
    .filter((name) => name !== "_prisma_migrations")
    .map((name) => `"public"."${name}"`);

  if (targets.length === 0) return;

  await db.$executeRawUnsafe(
    `TRUNCATE TABLE ${targets.join(", ")} RESTART IDENTITY CASCADE`,
  );
};
