-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "discountedAmountInCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "discountedAmountInCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderDessert" ADD COLUMN     "discountedAmountInCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "offerId" TEXT;

-- AddForeignKey
ALTER TABLE "OrderDessert" ADD CONSTRAINT "OrderDessert_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
