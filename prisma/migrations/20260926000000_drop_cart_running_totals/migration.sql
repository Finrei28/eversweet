-- Drop the cart's running totals: Cart.totalPriceInCents and Cart.totalLoyaltyPointsUsed
--
-- *** DEPLOY ORDER: run this only once the order server built from a schema WITHOUT     ***
-- *** these columns is live (eversweet_app, "Drop the cart's running totals from the    ***
-- *** schema"). A server whose Prisma client still knows them reads them back on every   ***
-- *** cart query - even one that no longer writes them - so it fails with "column does  ***
-- *** not exist" on every cart request until redeployed. The new server works with the   ***
-- *** columns present, so deploying it first is always safe. The website never touches   ***
-- *** Cart.                                                                                ***
--
-- Prisma's own generated SQL would be exactly the statement below. It is written by hand
-- only so the migration carries this warning; there is nothing to backfill and nothing to
-- assert. Both columns were derived figures, nudged by every cart write, that drifted from
-- the lines they described while nothing read them. What a cart costs is worked out from
-- its rows every time (calculateCartPrice in the order server), so dropping them loses no
-- information.

ALTER TABLE "Cart" DROP COLUMN "totalLoyaltyPointsUsed",
DROP COLUMN "totalPriceInCents";
