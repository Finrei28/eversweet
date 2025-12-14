/*
  Warnings:

  - You are about to drop the column `discountedAmountInCents` on the `CartItem` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `CartItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CartItem" DROP COLUMN "discountedAmountInCents",
DROP COLUMN "quantity";

-- AlterTable
ALTER TABLE "CartItemDessert" ADD COLUMN     "discountedAmountInCents" INTEGER NOT NULL DEFAULT 0;
