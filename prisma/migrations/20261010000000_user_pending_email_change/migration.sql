-- Lets a customer change their account's email address in the app, once they have proved they
-- own the new one: the order server mails a code to the new address and changes `email` only
-- when that code comes back.
--
-- Written by hand in place of:
--   npx prisma migrate dev --create-only --name user_pending_email_change
-- run from C:\Personal Projects\eversweet
--
-- This is exactly the SQL Prisma would generate (`prisma migrate diff` against the previous
-- schema), and nothing more. All three columns are nullable and NULL is the right starting
-- value: it means no change is pending, which is true of every account today.
--
-- Purely additive, so there is nothing to backfill or assert against: no existing value is
-- moved, rewritten or dropped.
--
-- Rollout: this migration first, then this site and the order server. A Prisma client built
-- from this schema selects these columns on any `user` query without a `select`, and fails with
-- "column does not exist" against a database without them. Then the app build, which is the
-- only thing that writes them.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailChangeOtp" TEXT,
ADD COLUMN     "emailChangeOtpExpiresAt" TIMESTAMP(3),
ADD COLUMN     "pendingEmail" TEXT;
