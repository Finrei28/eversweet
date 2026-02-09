-- CreateEnum
CREATE TYPE "PromoType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateTable
CREATE TABLE "Promo" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PromoType" NOT NULL,
    "value" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),

    CONSTRAINT "Promo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PromoDesserts" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_PromoCategories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_PromoDesserts_AB_unique" ON "_PromoDesserts"("A", "B");

-- CreateIndex
CREATE INDEX "_PromoDesserts_B_index" ON "_PromoDesserts"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_PromoCategories_AB_unique" ON "_PromoCategories"("A", "B");

-- CreateIndex
CREATE INDEX "_PromoCategories_B_index" ON "_PromoCategories"("B");

-- AddForeignKey
ALTER TABLE "_PromoDesserts" ADD CONSTRAINT "_PromoDesserts_A_fkey" FOREIGN KEY ("A") REFERENCES "Dessert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PromoDesserts" ADD CONSTRAINT "_PromoDesserts_B_fkey" FOREIGN KEY ("B") REFERENCES "Promo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PromoCategories" ADD CONSTRAINT "_PromoCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PromoCategories" ADD CONSTRAINT "_PromoCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "Promo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
