/*
  Warnings:

  - Added the required column `chineseName` to the `DessertCustomisation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DessertCustomisation" ADD COLUMN     "chineseName" TEXT NOT NULL;
