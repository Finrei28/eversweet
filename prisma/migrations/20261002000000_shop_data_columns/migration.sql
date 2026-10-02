-- Three columns the customer app's walkthrough asked for (TODO item 8 in the app repo, entries
-- 1, 11 and 31): an end date for an announcement, the shop's About text, and the order a
-- ledger record was earned by.
--
-- Written by hand in place of:
--   npx prisma migrate dev --create-only --name shop_data_columns
-- run from C:\Personal Projects\eversweet
--
-- This is exactly the SQL Prisma would generate, and nothing more (checked with
-- `prisma migrate diff`). Every column is nullable and NULL is the right starting value:
-- - `Announcement.endsAt`: no announcement has an end date, so each runs until it is
--   switched off, as before.
-- - `ShopProfile.about`: the app shows the text it was built with until one is saved.
-- - `LoyaltyRecord.orderId`: no backfill. The ledger has never recorded which order a record
--   came from, and matching records to orders by time would be a guess written down as a
--   fact. Orders from before this migration show no points earned.
--
-- Purely additive, so there is nothing to assert against: no existing value is moved,
-- rewritten or dropped.
--
-- `orderId` is SET NULL on delete: the record is the customer's points history and outlives
-- the order. The index serves the order list, which reads each order's EARNED record through
-- this relation in the same query.
--
-- Rollout: this migration first, then the order server (its Prisma client selects these
-- columns on every read of these tables), then this site's admin, then the app.

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "endsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LoyaltyRecord" ADD COLUMN     "orderId" TEXT;

-- AlterTable
ALTER TABLE "ShopProfile" ADD COLUMN     "about" TEXT;

-- CreateIndex
CREATE INDEX "LoyaltyRecord_orderId_idx" ON "LoyaltyRecord"("orderId");

-- AddForeignKey
ALTER TABLE "LoyaltyRecord" ADD CONSTRAINT "LoyaltyRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
