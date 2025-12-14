/*
  Warnings:

  - You are about to drop the column `categoryId` on the `Offer` table. All the data in the column will be lost.
  - You are about to drop the column `dessertId` on the `Offer` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Offer" DROP CONSTRAINT "Offer_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Offer" DROP CONSTRAINT "Offer_dessertId_fkey";

-- AlterTable
ALTER TABLE "Offer" DROP COLUMN "categoryId",
DROP COLUMN "dessertId",
ADD COLUMN     "membersOffer" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "_OfferDesserts" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_OfferCategories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_OfferDesserts_AB_unique" ON "_OfferDesserts"("A", "B");

-- CreateIndex
CREATE INDEX "_OfferDesserts_B_index" ON "_OfferDesserts"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_OfferCategories_AB_unique" ON "_OfferCategories"("A", "B");

-- CreateIndex
CREATE INDEX "_OfferCategories_B_index" ON "_OfferCategories"("B");

-- AddForeignKey
ALTER TABLE "_OfferDesserts" ADD CONSTRAINT "_OfferDesserts_A_fkey" FOREIGN KEY ("A") REFERENCES "Dessert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OfferDesserts" ADD CONSTRAINT "_OfferDesserts_B_fkey" FOREIGN KEY ("B") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OfferCategories" ADD CONSTRAINT "_OfferCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OfferCategories" ADD CONSTRAINT "_OfferCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
