/*
  Warnings:

  - You are about to drop the `_PromoCategories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_PromoDesserts` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_PromoCategories" DROP CONSTRAINT "_PromoCategories_A_fkey";

-- DropForeignKey
ALTER TABLE "_PromoCategories" DROP CONSTRAINT "_PromoCategories_B_fkey";

-- DropForeignKey
ALTER TABLE "_PromoDesserts" DROP CONSTRAINT "_PromoDesserts_A_fkey";

-- DropForeignKey
ALTER TABLE "_PromoDesserts" DROP CONSTRAINT "_PromoDesserts_B_fkey";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "promoId" TEXT;

-- AlterTable
ALTER TABLE "Dessert" ADD COLUMN     "promoId" TEXT;

-- DropTable
DROP TABLE "_PromoCategories";

-- DropTable
DROP TABLE "_PromoDesserts";

-- AddForeignKey
ALTER TABLE "Dessert" ADD CONSTRAINT "Dessert_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "Promo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "Promo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
