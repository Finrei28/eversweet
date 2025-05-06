-- CreateTable
CREATE TABLE "Loyalty" (
    "id" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Loyalty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Loyalty_userId_key" ON "Loyalty"("userId");

-- AddForeignKey
ALTER TABLE "Loyalty" ADD CONSTRAINT "Loyalty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
