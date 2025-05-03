/*
  Warnings:

  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('WEBSITE', 'APP');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "appUserId" TEXT,
ADD COLUMN     "source" "OrderSource" NOT NULL DEFAULT 'WEBSITE';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "name",
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
