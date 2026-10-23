-- Records whether a customer has agreed to pushes about new offers, and when they answered.
--
-- Written by hand in place of:
--   npx prisma migrate dev --create-only --name user_offer_push_opt_in
-- run from C:\Personal Projects\eversweet
--
-- This is exactly the SQL Prisma would generate (`prisma migrate diff` against the previous
-- schema), and nothing more. App Review allows marketing pushes only to customers who opted in
-- through consent wording in the app (guideline 4.5.4), and the new-offer push is the one
-- message the shop sends that is not about the customer's own account. So every account starts
-- opted out, those from before this included: NULL in `offerPushAnsweredAt` means nobody has
-- asked them, and the app asks once.
--
-- Purely additive, so there is nothing to backfill or assert against: no existing value is
-- moved, rewritten or dropped. Backfilling `offerPushOptIn = true` would record a consent that
-- was never given, which is the thing the guideline forbids.
--
-- Rollout: this migration first, then this site and the order server. A Prisma client built
-- from this schema selects these columns on any `user` query without a `select`, and fails with
-- "column does not exist" against a database without them. Then the app build, which is the
-- only thing that asks. Offer pushes reach nobody from the moment the server is out until
-- customers start answering yes.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "offerPushAnsweredAt" TIMESTAMP(3),
ADD COLUMN     "offerPushOptIn" BOOLEAN NOT NULL DEFAULT false;
