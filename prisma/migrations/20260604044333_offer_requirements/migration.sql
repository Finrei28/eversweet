/*
  Warnings:

  - Added the required column `status` to the `OfferRedemption` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('AVAILABLE', 'REDEEMED', 'EXPIRED');

-- AlterTable
ALTER TABLE "OfferRedemption" ADD COLUMN     "status" "OfferStatus" NOT NULL,
ADD COLUMN     "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "redeemedAt" DROP NOT NULL,
ALTER COLUMN "redeemedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "OfferRequirement" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "dessertId" TEXT,
    "categoryId" TEXT,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "OfferRequirement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OfferRequirement" ADD CONSTRAINT "OfferRequirement_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferRequirement" ADD CONSTRAINT "OfferRequirement_dessertId_fkey" FOREIGN KEY ("dessertId") REFERENCES "Dessert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferRequirement" ADD CONSTRAINT "OfferRequirement_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
