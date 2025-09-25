/*
  Warnings:

  - You are about to drop the column `ingredients` on the `Dessert` table. All the data in the column will be lost.
  - You are about to drop the `DessertCustomisation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DessertCustomisationOnDessert` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "IngredientType" AS ENUM ('MOCHI', 'GLUTINOUS_BALLS', 'OSMANTHUS', 'TARO', 'MANGO', 'PURPLE_RICE', 'GRAPES', 'BOBA', 'RED_BEANS', 'SAGO', 'COCONUT_JELLY', 'GRASS_JELLY', 'TARO_CREAM', 'SNOW_SWALLOW', 'PEACH_GUM', 'COCONUT_MILK', 'MILK_PUDDING', 'BLACK_SESAME', 'PEANUT', 'MUNG_BEAN', 'PISTACHIO', 'PUMPKIN', 'TARO_BALLS', 'SWEET_POTATO', 'NOODLES', 'BROWN_SUGAR', 'TOFU', 'DURIAN');

-- DropForeignKey
ALTER TABLE "CategoryCustomisation" DROP CONSTRAINT "CategoryCustomisation_customisationId_fkey";

-- DropForeignKey
ALTER TABLE "CustomisationInCartItem" DROP CONSTRAINT "CustomisationInCartItem_customisationId_fkey";

-- DropForeignKey
ALTER TABLE "DessertCustomisationOnDessert" DROP CONSTRAINT "DessertCustomisationOnDessert_customisationId_fkey";

-- DropForeignKey
ALTER TABLE "DessertCustomisationOnDessert" DROP CONSTRAINT "DessertCustomisationOnDessert_dessertId_fkey";

-- DropForeignKey
ALTER TABLE "OrderDessertCustomisation" DROP CONSTRAINT "OrderDessertCustomisation_customisationId_fkey";

-- AlterTable
ALTER TABLE "Dessert" DROP COLUMN "ingredients";

-- DropTable
DROP TABLE "DessertCustomisation";

-- DropTable
DROP TABLE "DessertCustomisationOnDessert";

-- DropEnum
DROP TYPE "ingredients";

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "chineseName" TEXT NOT NULL,
    "priceInCents" INTEGER NOT NULL,
    "isAvailableForPurchase" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DessertIngredient" (
    "dessertId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,

    CONSTRAINT "DessertIngredient_pkey" PRIMARY KEY ("dessertId","ingredientId")
);

-- AddForeignKey
ALTER TABLE "DessertIngredient" ADD CONSTRAINT "DessertIngredient_dessertId_fkey" FOREIGN KEY ("dessertId") REFERENCES "Dessert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DessertIngredient" ADD CONSTRAINT "DessertIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryCustomisation" ADD CONSTRAINT "CategoryCustomisation_customisationId_fkey" FOREIGN KEY ("customisationId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDessertCustomisation" ADD CONSTRAINT "OrderDessertCustomisation_customisationId_fkey" FOREIGN KEY ("customisationId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomisationInCartItem" ADD CONSTRAINT "CustomisationInCartItem_customisationId_fkey" FOREIGN KEY ("customisationId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
