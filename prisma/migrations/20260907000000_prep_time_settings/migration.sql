-- CreateTable
CREATE TABLE "PrepTimeSetting" (
    "id" TEXT NOT NULL,
    "singleItem" INTEGER NOT NULL DEFAULT 5,
    "upToThree" INTEGER NOT NULL DEFAULT 10,
    "upToSix" INTEGER NOT NULL DEFAULT 15,
    "moreThanSix" INTEGER NOT NULL DEFAULT 20,
    "kitchenSlack" INTEGER NOT NULL DEFAULT 1,
    "quoteFloor" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrepTimeSetting_pkey" PRIMARY KEY ("id")
);

-- Seed the single row, so the settings screen has something to edit and the
-- application is not relying on its fallback from the moment it deploys. The
-- column defaults are the values that were previously hardcoded, so this
-- changes no behaviour.
INSERT INTO "PrepTimeSetting" ("id", "updatedAt")
VALUES ('default', NOW())
ON CONFLICT ("id") DO NOTHING;
