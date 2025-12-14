-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "isPromotionItem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "promotionType" TEXT;
