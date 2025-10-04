-- CreateTable
CREATE TABLE "LoyaltyRecord" (
    "id" TEXT NOT NULL,
    "change" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loyaltyId" TEXT NOT NULL,

    CONSTRAINT "LoyaltyRecord_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LoyaltyRecord" ADD CONSTRAINT "LoyaltyRecord_loyaltyId_fkey" FOREIGN KEY ("loyaltyId") REFERENCES "Loyalty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
