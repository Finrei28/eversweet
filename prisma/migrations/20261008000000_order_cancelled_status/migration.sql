-- A CANCELLED order status, and the time an order was cancelled.
--
-- Written by hand in place of:
--   npx prisma migrate dev --create-only --name order_cancelled_status
-- run from C:\Personal Projects\eversweet
--
-- This is exactly the SQL Prisma would generate, and nothing more. Purely additive, so there
-- is nothing to assert against: no existing order changes status, and `cancelledAt` starts
-- NULL on every row, which is right - no order has been cancelled yet.
--
-- `ALTER TYPE ... ADD VALUE` may run inside Prisma's migration transaction (Postgres 12 and
-- later) because nothing in this transaction uses the new value.
--
-- Staff cancel an order from the staff app, through the order server, which also takes back
-- the points it earned and returns the points spent on it. A cancelled order is final and is
-- not a valid order: sales, order counts, the leaderboard and the points-expiry clock all
-- leave it out. No money moves; a refund is made in Stripe.
--
-- Rollout: this migration first. Then this site and the order server, both built from this
-- schema, before anybody can cancel an order: a Prisma client that does not know CANCELLED
-- throws reading an order that has it. Then the staff app build, which is the only way to
-- cancel one.

-- AlterEnum
ALTER TYPE "Status" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cancelledAt" TIMESTAMP(3);
