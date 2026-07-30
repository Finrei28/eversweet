/*
  Warnings:

  - You are about to drop the column `dayOff` on the `DaysOff` table. All the data in the column will be lost.
  - Added the required column `date` to the `DaysOff` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DaysOff" DROP COLUMN "dayOff",
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL;
