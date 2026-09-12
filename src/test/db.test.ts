/**
 * The guard in `resetDatabase` is the only thing standing between a test run and the
 * production database, since DATABASE_URL in this repo is Supabase. Worth a test of its
 * own: if it ever stops refusing, nothing else would say so until it was too late.
 */
import { expect, it } from "vitest";
import { itIfDb, resetDatabase } from "./db";

it("refuses to truncate a database whose name lacks 'test'", async () => {
  const real = process.env.DATABASE_URL;
  process.env.DATABASE_URL =
    "postgresql://u:p@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres";
  await expect(resetDatabase()).rejects.toThrow(
    /Refusing to truncate "postgres"/,
  );
  process.env.DATABASE_URL = real;
});

// Guarded: without TEST_DATABASE_URL there is no test database to proceed against, and
// an unconditional assertion here would fail `npm test` for anyone who has not set one
// up - exactly what `describeIfDb` exists to avoid.
itIfDb("proceeds against the test database", async () => {
  expect(process.env.DATABASE_URL).toContain("eversweet_web_test");
  await expect(resetDatabase()).resolves.toBeUndefined();
});
