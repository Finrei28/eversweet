/*
  Warnings:

  - You are about to drop the column `discountedAmountInCents` on the `CartItem` table. All the data in the column will be lost.
  - You are about to drop the column `itemPriceInCents` on the `CartItem` table. All the data in the column will be lost.
  - You are about to drop the column `loyaltyPointsUsed` on the `CartItem` table. All the data in the column will be lost.
  - Added the required column `cartItemPriceInCents` to the `CartItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `itemPriceInCents` to the `CartItemDessert` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CartItem" DROP COLUMN "discountedAmountInCents",
DROP COLUMN "itemPriceInCents",
DROP COLUMN "loyaltyPointsUsed",
ADD COLUMN     "cartItemPriceInCents" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "CartItemDessert" ADD COLUMN     "discountedAmountInCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "itemPriceInCents" INTEGER NOT NULL,
ADD COLUMN     "loyaltyPointsUsed" INTEGER;
