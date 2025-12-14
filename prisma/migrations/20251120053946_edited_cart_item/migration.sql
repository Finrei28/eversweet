/*
  Warnings:

  - A unique constraint covering the columns `[cartId,promotionType,dessertId]` on the table `CartItem` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_promotionType_dessertId_key" ON "CartItem"("cartId", "promotionType", "dessertId");
