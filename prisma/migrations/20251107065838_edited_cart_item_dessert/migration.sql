-- DropForeignKey
ALTER TABLE "CartItemDessert" DROP CONSTRAINT "CartItemDessert_cartItemId_fkey";

-- DropForeignKey
ALTER TABLE "CartItemDessert" DROP CONSTRAINT "CartItemDessert_dessertId_fkey";

-- AddForeignKey
ALTER TABLE "CartItemDessert" ADD CONSTRAINT "CartItemDessert_cartItemId_fkey" FOREIGN KEY ("cartItemId") REFERENCES "CartItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItemDessert" ADD CONSTRAINT "CartItemDessert_dessertId_fkey" FOREIGN KEY ("dessertId") REFERENCES "Dessert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
