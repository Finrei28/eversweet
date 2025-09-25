-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "totalLoyaltyPointsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalPriceInCents" INTEGER NOT NULL DEFAULT 0;
