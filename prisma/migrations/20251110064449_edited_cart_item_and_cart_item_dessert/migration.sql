/*
  Warnings:

  - You are about to drop the column `discountedAmountInCents` on the `CartItemDessert` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "discountedAmountInCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CartItemDessert" DROP COLUMN "discountedAmountInCents";
