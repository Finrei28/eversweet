-- CreateTable
CREATE TABLE "CategoryCustomisation" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "customisationId" TEXT NOT NULL,

    CONSTRAINT "CategoryCustomisation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoryCustomisation_categoryId_customisationId_key" ON "CategoryCustomisation"("categoryId", "customisationId");

-- AddForeignKey
ALTER TABLE "CategoryCustomisation" ADD CONSTRAINT "CategoryCustomisation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryCustomisation" ADD CONSTRAINT "CategoryCustomisation_customisationId_fkey" FOREIGN KEY ("customisationId") REFERENCES "DessertCustomisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
