-- AlterTable
ALTER TABLE "LoyaltyWinner" ADD COLUMN     "results" TEXT[],
ALTER COLUMN "userId" DROP NOT NULL;
