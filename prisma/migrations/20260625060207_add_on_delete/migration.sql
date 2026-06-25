-- DropForeignKey
ALTER TABLE "Loyalty" DROP CONSTRAINT "Loyalty_userId_fkey";

-- AddForeignKey
ALTER TABLE "Loyalty" ADD CONSTRAINT "Loyalty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
