/*
  Warnings:

  - You are about to drop the column `CartItemDessertId` on the `CustomisationInCartItem` table. All the data in the column will be lost.
  - You are about to drop the column `membersOffer` on the `Offer` table. All the data in the column will be lost.
  - You are about to drop the column `numberOfPicks` on the `Offer` table. All the data in the column will be lost.
  - You are about to drop the column `priceInCents` on the `Offer` table. All the data in the column will be lost.
  - You are about to drop the `CartItemDessert` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_OfferCategories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_OfferDesserts` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[cartItemId,customisationId]` on the table `CustomisationInCartItem` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `dessertId` to the `CartItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `itemPriceInCents` to the `CartItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quantity` to the `CartItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cartItemId` to the `CustomisationInCartItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CartItemDessert" DROP CONSTRAINT "CartItemDessert_cartItemId_fkey";

-- DropForeignKey
ALTER TABLE "CartItemDessert" DROP CONSTRAINT "CartItemDessert_dessertId_fkey";

-- DropForeignKey
ALTER TABLE "CustomisationInCartItem" DROP CONSTRAINT "CustomisationInCartItem_CartItemDessertId_fkey";

-- DropForeignKey
ALTER TABLE "_OfferCategories" DROP CONSTRAINT "_OfferCategories_A_fkey";

-- DropForeignKey
ALTER TABLE "_OfferCategories" DROP CONSTRAINT "_OfferCategories_B_fkey";

-- DropForeignKey
ALTER TABLE "_OfferDesserts" DROP CONSTRAINT "_OfferDesserts_A_fkey";

-- DropForeignKey
ALTER TABLE "_OfferDesserts" DROP CONSTRAINT "_OfferDesserts_B_fkey";

-- DropIndex
DROP INDEX "CustomisationInCartItem_CartItemDessertId_customisationId_key";

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "totalLoyaltyPointsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalPriceInCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "dessertId" TEXT NOT NULL,
ADD COLUMN     "discountedAmountInCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "itemPriceInCents" INTEGER NOT NULL,
ADD COLUMN     "loyaltyPointsUsed" INTEGER,
ADD COLUMN     "quantity" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "CustomisationInCartItem" DROP COLUMN "CartItemDessertId",
ADD COLUMN     "cartItemId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Offer" DROP COLUMN "membersOffer",
DROP COLUMN "numberOfPicks",
DROP COLUMN "priceInCents",
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "dessertId" TEXT,
ADD COLUMN     "itemPriceInCents" INTEGER;

-- DropTable
DROP TABLE "CartItemDessert";

-- DropTable
DROP TABLE "_OfferCategories";

-- DropTable
DROP TABLE "_OfferDesserts";

-- CreateIndex
CREATE UNIQUE INDEX "CustomisationInCartItem_cartItemId_customisationId_key" ON "CustomisationInCartItem"("cartItemId", "customisationId");

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_dessertId_fkey" FOREIGN KEY ("dessertId") REFERENCES "Dessert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_dessertId_fkey" FOREIGN KEY ("dessertId") REFERENCES "Dessert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomisationInCartItem" ADD CONSTRAINT "CustomisationInCartItem_cartItemId_fkey" FOREIGN KEY ("cartItemId") REFERENCES "CartItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
