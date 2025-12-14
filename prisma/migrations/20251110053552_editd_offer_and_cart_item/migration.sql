/*
  Warnings:

  - You are about to drop the column `totalLoyaltyPointsUsed` on the `Cart` table. All the data in the column will be lost.
  - You are about to drop the column `totalPriceInCents` on the `Cart` table. All the data in the column will be lost.
  - You are about to drop the column `itemPriceInCents` on the `Offer` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Cart" DROP COLUMN "totalLoyaltyPointsUsed",
DROP COLUMN "totalPriceInCents";

-- AlterTable
ALTER TABLE "Offer" DROP COLUMN "itemPriceInCents",
ADD COLUMN     "priceInCents" INTEGER;
