/*
  Warnings:

  - You are about to drop the column `discountedAmountInCents` on the `CartItemDessert` table. All the data in the column will be lost.
  - You are about to drop the column `loyaltyPointsUsed` on the `CartItemDessert` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "discountedAmountInCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyPointsUsed" INTEGER;

-- AlterTable
ALTER TABLE "CartItemDessert" DROP COLUMN "discountedAmountInCents",
DROP COLUMN "loyaltyPointsUsed";
