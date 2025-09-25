/*
  Warnings:

  - You are about to drop the `CustomisationInCart` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DessertInCart` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_dessertId_fkey";

-- DropForeignKey
ALTER TABLE "CustomisationInCart" DROP CONSTRAINT "CustomisationInCart_cartItemId_fkey";

-- DropTable
DROP TABLE "CustomisationInCart";

-- DropTable
DROP TABLE "DessertInCart";

-- CreateTable
CREATE TABLE "CustomisationInCartItem" (
    "id" TEXT NOT NULL,
    "cartItemId" TEXT NOT NULL,
    "customisationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CustomisationInCartItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomisationInCartItem_cartItemId_customisationId_key" ON "CustomisationInCartItem"("cartItemId", "customisationId");

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_dessertId_fkey" FOREIGN KEY ("dessertId") REFERENCES "Dessert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomisationInCartItem" ADD CONSTRAINT "CustomisationInCartItem_customisationId_fkey" FOREIGN KEY ("customisationId") REFERENCES "DessertCustomisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomisationInCartItem" ADD CONSTRAINT "CustomisationInCartItem_cartItemId_fkey" FOREIGN KEY ("cartItemId") REFERENCES "CartItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
