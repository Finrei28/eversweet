-- A switch for taking the monthly leaderboard out of the customer app and putting it back,
-- from this site's /admin/settings.
--
-- Written by hand in place of:
--   npx prisma migrate dev --create-only --name leaderboard_hidden
-- run from C:\Personal Projects\eversweet
--
-- This is exactly the SQL Prisma would generate, and nothing more. The column is nullable and
-- NULL is the right starting value: it means shown, which is what the app has always done, so
-- nothing changes until somebody hides the board.
--
-- Purely additive, so there is nothing to backfill or assert against: no existing value is
-- moved, rewritten or dropped.
--
-- Rollout: this migration first, then the order server (its Prisma client selects this column
-- with the loyalty rates, and a failed read there falls back to the default rates on every
-- order), then this site's admin, then the app.

-- AlterTable
ALTER TABLE "LoyaltySetting" ADD COLUMN     "leaderboardHiddenAt" TIMESTAMP(3);
