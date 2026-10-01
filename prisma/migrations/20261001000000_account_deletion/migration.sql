-- Account deletion from the app: the customer asks, and the order server deletes the account
-- seven days later unless they cancel. Apple and Google both expect an app that creates accounts
-- to let people start deletion in it, and the Terms and Privacy Policy said there was no way to.
--
-- Written by hand in place of:
--   npx prisma migrate dev --create-only --name account_deletion
-- run from C:\Personal Projects\eversweet
--
-- This is exactly the SQL Prisma would generate, and nothing more. Both columns are nullable and
-- NULL is the right starting value: nobody has asked to be deleted. No backfill.
--
-- The order server writes both when a deletion is requested and clears both when it is
-- cancelled (`requestAccountDeletion` / `cancelAccountDeletion`), and its nightly sweep
-- (`lib/accountDeletion`) deletes the users whose `deletionScheduledFor` has passed. No index:
-- the sweep runs once a night over a table of customers, and a partial index on the few
-- non-NULL rows is not something the schema can express.
--
-- Rollout: this migration first, then the order server (its Prisma client selects these
-- columns on every user read), then the app.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "deletionScheduledFor" TIMESTAMP(3);
