/*
  Warnings:

  - You are about to drop the column `completed` on the `Order` table. All the data in the column will be lost.
  - Added the required column `status` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Status" AS ENUM ('PENDING', 'COMPLETED', 'PICKED_UP');

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "completed",
ADD COLUMN     "pickedUpAt" TIMESTAMP(3),
ADD COLUMN     "status" "Status" NOT NULL;

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");
