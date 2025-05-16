-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dessertId" TEXT NOT NULL,
    "itemPriceInCents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "loyaltyPointsUsed" INTEGER,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomisationInCart" (
    "id" TEXT NOT NULL,
    "cartItemId" TEXT NOT NULL,
    "chineseName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "CustomisationInCart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DessertInCart" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "chineseName" TEXT NOT NULL,
    "description" TEXT,
    "priceInCents" INTEGER NOT NULL,
    "priceInLoyaltyPoints" INTEGER NOT NULL,
    "imagePath" TEXT NOT NULL,
    "ingredients" TEXT[],

    CONSTRAINT "DessertInCart_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_dessertId_fkey" FOREIGN KEY ("dessertId") REFERENCES "DessertInCart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomisationInCart" ADD CONSTRAINT "CustomisationInCart_cartItemId_fkey" FOREIGN KEY ("cartItemId") REFERENCES "CartItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
