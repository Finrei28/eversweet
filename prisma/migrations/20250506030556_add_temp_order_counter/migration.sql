-- CreateTable
CREATE TABLE "TempOrderCounter" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "date" TIMESTAMP(3) NOT NULL,
    "counter" INTEGER NOT NULL,

    CONSTRAINT "TempOrderCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TempOrderCounter_date_key" ON "TempOrderCounter"("date");
