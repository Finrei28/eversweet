-- CreateTable
CREATE TABLE "LoyaltyWinner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyWinner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoyaltyWinner_userId_idx" ON "LoyaltyWinner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyWinner_month_year_key" ON "LoyaltyWinner"("month", "year");

-- AddForeignKey
ALTER TABLE "LoyaltyWinner" ADD CONSTRAINT "LoyaltyWinner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
