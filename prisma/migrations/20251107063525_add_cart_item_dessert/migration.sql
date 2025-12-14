/*
  Warnings:

  - You are about to drop the column `dessertId` on the `CartItem` table. All the data in the column will be lost.
  - You are about to drop the column `discountedAmountInCents` on the `CartItem` table. All the data in the column will be lost.
  - You are about to drop the column `itemPriceInCents` on the `CartItem` table. All the data in the column will be lost.
  - You are about to drop the column `loyaltyPointsUsed` on the `CartItem` table. All the data in the column will be lost.
  - You are about to drop the column `cartItemId` on the `CustomisationInCartItem` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[CartItemDessertId,customisationId]` on the table `CustomisationInCartItem` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `CartItemDessertId` to the `CustomisationInCartItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_dessertId_fkey";

-- DropForeignKey
ALTER TABLE "CustomisationInCartItem" DROP CONSTRAINT "CustomisationInCartItem_cartItemId_fkey";

-- DropIndex
DROP INDEX "CustomisationInCartItem_cartItemId_customisationId_key";

-- AlterTable
ALTER TABLE "CartItem" DROP COLUMN "dessertId",
DROP COLUMN "discountedAmountInCents",
DROP COLUMN "itemPriceInCents",
DROP COLUMN "loyaltyPointsUsed",
ALTER COLUMN "quantity" SET DEFAULT 1;

-- AlterTable
ALTER TABLE "CustomisationInCartItem" DROP COLUMN "cartItemId",
ADD COLUMN     "CartItemDessertId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "CartItemDessert" (
    "id" TEXT NOT NULL,
    "itemPriceInCents" INTEGER NOT NULL,
    "discountedAmountInCents" INTEGER NOT NULL DEFAULT 0,
    "loyaltyPointsUsed" INTEGER,
    "cartItemId" TEXT NOT NULL,
    "dessertId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CartItemDessert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomisationInCartItem_CartItemDessertId_customisationId_key" ON "CustomisationInCartItem"("CartItemDessertId", "customisationId");

-- AddForeignKey
ALTER TABLE "CartItemDessert" ADD CONSTRAINT "CartItemDessert_cartItemId_fkey" FOREIGN KEY ("cartItemId") REFERENCES "CartItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItemDessert" ADD CONSTRAINT "CartItemDessert_dessertId_fkey" FOREIGN KEY ("dessertId") REFERENCES "Dessert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomisationInCartItem" ADD CONSTRAINT "CustomisationInCartItem_CartItemDessertId_fkey" FOREIGN KEY ("CartItemDessertId") REFERENCES "CartItemDessert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
