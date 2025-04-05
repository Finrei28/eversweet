/*
  Warnings:

  - You are about to drop the column `comment` on the `Feedback` table. All the data in the column will be lost.
  - Added the required column `feedbackMessage` to the `Feedback` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Feedback" DROP COLUMN "comment",
ADD COLUMN     "feedbackMessage" TEXT NOT NULL,
ADD COLUMN     "name" TEXT;
