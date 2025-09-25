/*
  Warnings:

  - You are about to drop the `_MembershipOffers` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "OfferRedemption" DROP CONSTRAINT "OfferRedemption_offerId_fkey";

-- DropForeignKey
ALTER TABLE "_MembershipOffers" DROP CONSTRAINT "_MembershipOffers_A_fkey";

-- DropForeignKey
ALTER TABLE "_MembershipOffers" DROP CONSTRAINT "_MembershipOffers_B_fkey";

-- DropTable
DROP TABLE "_MembershipOffers";

-- AddForeignKey
ALTER TABLE "OfferRedemption" ADD CONSTRAINT "OfferRedemption_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
