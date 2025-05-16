-- Step 1: Rename the old enum
ALTER TYPE "Status" RENAME TO "Status_old";

-- Step 2: Create the new enum type
CREATE TYPE "Status" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'MAKING',
  'READY',
  'PICKED_UP'
);

-- Step 3: Update your column(s) to use the new enum
-- Replace "orders" and "status" with your actual table and column names
ALTER TABLE "Order"
ALTER COLUMN "status" TYPE "Status"
USING "status"::text::"Status";

-- Step 4: Drop the old enum type
DROP TYPE "Status_old";
