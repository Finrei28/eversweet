/**
 * The guard in `resetDatabase` is the only thing standing between a test run and the
 * production database, since DATABASE_URL in this repo is Supabase. Worth a test of its
 * own: if it ever stops refusing, nothing else would say so until it was too late.
 */
import { expect, it } from "vitest";
import { resetDatabase } from "./db";

it("refuses to truncate a database whose name lacks 'test'", async () => {
  const real = process.env.DATABASE_URL;
  process.env.DATABASE_URL =
    "postgresql://u:p@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres";
  await expect(resetDatabase()).rejects.toThrow(/Refusing to truncate "postgres"/);
  process.env.DATABASE_URL = real;
});

it("proceeds against the test database", async () => {
  expect(process.env.DATABASE_URL).toContain("eversweet_web_test");
  await expect(resetDatabase()).resolves.toBeUndefined();
});
