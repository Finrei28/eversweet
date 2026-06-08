-- AlterTable
ALTER TABLE "MembershipPlan" ADD COLUMN     "maxDiscount" INTEGER NOT NULL DEFAULT 25,
ALTER COLUMN "membershipDiscount" SET DEFAULT 5;
