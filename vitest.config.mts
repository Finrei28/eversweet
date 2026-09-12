import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Read `.env` here rather than leaving it to whatever Vitest happens to inject, so the
 * database a test connects to is decided in one visible place.
 *
 * This matters more than it looks. `src/server/db.ts` builds its client from
 * `DATABASE_URL`, which in this repo is **production Supabase**. A setup file that tries
 * to swap in TEST_DATABASE_URL after the fact runs before `.env` is necessarily readable,
 * silently leaves DATABASE_URL pointing at production, and the first `resetDatabase()`
 * truncates the live database — the 2026-09-11 incident again, from a different direction.
 * Deciding it at config time removes the ordering question entirely.
 *
 * `src/test/db.ts` still refuses a URL whose database name has no "test" in it. Two
 * independent guards, because only one of them has to be wrong.
 */
const env = loadEnv("test", process.cwd(), "");

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
    // Integration suites share one database and truncate between cases, so running
    // files side by side would have them clearing each other's rows mid-test.
    fileParallelism: false,
    ...(env.TEST_DATABASE_URL
      ? {
          env: {
            DATABASE_URL: env.TEST_DATABASE_URL,
            DIRECT_URL: env.TEST_DATABASE_URL,
            TEST_DATABASE_URL: env.TEST_DATABASE_URL,
          },
        }
      : {}),
  },
  resolve: {
    alias: {
      // Matches the `~/*` path mapping in tsconfig.json.
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
