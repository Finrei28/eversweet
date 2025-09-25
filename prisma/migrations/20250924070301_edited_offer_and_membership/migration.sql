/*
  Warnings:

  - You are about to drop the column `totalWeeks` on the `Membership` table. All the data in the column will be lost.
  - The `used` column on the `OfferRedemption` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Membership" DROP COLUMN "totalWeeks",
ADD COLUMN     "totalMonths" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "limit" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "OfferRedemption" DROP COLUMN "used",
ADD COLUMN     "used" INTEGER NOT NULL DEFAULT 0;
