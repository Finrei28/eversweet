-- A reminder before a cancelled membership ends, so a member is not surprised by losing the
-- discount they have built up.
--
-- Written by hand in place of:
--   npx prisma migrate dev --create-only --name membership_end_warning
-- run from C:\Personal Projects\eversweet
--
-- This is exactly the SQL Prisma would generate, and nothing more. The column is nullable and
-- NULL is the right starting value: no reminder has been sent to anyone. There is deliberately
-- no backfill - a member already inside the three days before their end date on the first run
-- is someone the reminder is for.
--
-- The order server claims a reminder by writing the end date here (see
-- `claimEndWarning` in its lib/membershipReminders), the same shape as
-- `Loyalty.expiryWarnedFor` from 20260925000000_points_expiry.

ALTER TABLE "Membership" ADD COLUMN "endWarnedFor" TIMESTAMP(3);
