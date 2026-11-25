-- Combo offers: "any mochi + any sago for $15". One offer, 2-4 slots, each a dessert or a
-- category; the customer picks one dessert per slot in the app, and the set costs one price.
--
-- Written by hand in place of:
--   npx prisma migrate dev --create-only --name offer_combos
-- run from C:\Personal Projects\eversweet
--
-- Prisma would generate steps 1-3 alone: the price column, the slot table and its keys,
-- and the two `comboId` columns. Everything after that is CHECK constraints, which Prisma's
-- schema language cannot express.
--
-- Additive, so there is nothing to assert. Every new column starts NULL and the slot table
-- starts empty, which satisfies every constraint below; the one constraint replaced, the
-- offer's exactly-one-price rule, accepts every row the old one did, since no offer has a
-- combo price yet. Over an empty database - a shadow, or `migrate deploy` building a fresh
-- local one - all of it applies the same.
--
-- Why the shape it has:
--   * A combo's price is its own column rather than `itemPriceInCents` on an offer naming
--     neither a dessert nor a category. Code that does not know about combos - an order
--     server or app build from before them - then finds an offer covering nothing and
--     refuses it (the order server's `offerCoversDessert`), rather than reading a $15 set
--     as a $15 bowl.
--   * One dessert per cart line, as before. A combo's lines share a `comboId`; the price
--     is split across them, each line carrying its share as a discount, so totals, GST,
--     points, receipts and emails need no change. A November 2025 attempt made a cart line
--     a container of desserts instead and was reverted a week later.
--   * No slot id on a line. Lines are matched to slots as a set (24 ways at most), so
--     editing a running combo's slots cannot leave a line pointing at a deleted slot.
--
-- Rollout: this migration first, then either server. A Prisma client built from this
-- schema selects the new columns on every read of Offer, CartItem and OrderDessert, and
-- fails with "column does not exist" against a database without them. Both deployed
-- servers predate the columns and keep working with them present. No combo can be made
-- until the website's admin authoring ships, which waits for an app build that can show one.

-- 1. The price of the whole set, in cents. 0 is free, as for `itemPriceInCents`.
--
-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "comboPriceInCents" INTEGER;

-- 2. Which combo a line is one bowl of. A plain group key: the order server makes a fresh
--    one each time a combo goes into a cart, and the order copies it.
--
-- AlterTable
ALTER TABLE "OrderDessert" ADD COLUMN     "comboId" TEXT;

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "comboId" TEXT;

-- 3. The slots. Cascade from the offer, which is never deleted in practice (offers are
--    archived), and RESTRICT on what a slot names: a slot set to NULL would name nothing.
--
-- CreateTable
CREATE TABLE "OfferComboSlot" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "dessertId" TEXT,
    "categoryId" TEXT,

    CONSTRAINT "OfferComboSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfferComboSlot_offerId_position_key" ON "OfferComboSlot"("offerId", "position");

-- AddForeignKey
ALTER TABLE "OfferComboSlot" ADD CONSTRAINT "OfferComboSlot_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferComboSlot" ADD CONSTRAINT "OfferComboSlot_dessertId_fkey" FOREIGN KEY ("dessertId") REFERENCES "Dessert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferComboSlot" ADD CONSTRAINT "OfferComboSlot_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Still exactly one price, now out of three. `IS NULL <> IS NULL` cannot chain past two
--    columns; NUM_NONNULLS can, and a price of 0 still counts as set.
ALTER TABLE "Offer" DROP CONSTRAINT "Offer_exactly_one_price";
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_exactly_one_price"
  CHECK (NUM_NONNULLS("itemPriceInCents", "discountAmount", "comboPriceInCents") = 1);

-- 5. A combo price cannot be negative, for the reason a fixed price cannot. That it comes in
--    under the cheapest picks compares against Dessert, which a CHECK cannot reach; the
--    website's offers router holds it, as it holds the single-item ceiling.
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_comboPriceInCents_not_negative"
  CHECK ("comboPriceInCents" IS NULL OR "comboPriceInCents" >= 0);

-- 6. A combo's desserts are its slots, never a dessert, category or exclusions of its own.
--    One naming a category too would be listed and priced as a single-item offer by every
--    reader that does not know combos - the very thing step 1's own column prevents.
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_combo_names_no_dessert"
  CHECK (
    "comboPriceInCents" IS NULL
    OR ("dessertId" IS NULL AND "categoryId" IS NULL AND cardinality("excludedDessertIds") = 0)
  );

-- 7. A slot names one dessert or one category, never both and never neither.
ALTER TABLE "OfferComboSlot" ADD CONSTRAINT "OfferComboSlot_exactly_one_target"
  CHECK (NUM_NONNULLS("dessertId", "categoryId") = 1);

-- 8. Four slots at most, numbered from 0. Together with the unique index this caps a combo
--    at four; the router holds the floor of two, which a row-level CHECK cannot count.
ALTER TABLE "OfferComboSlot" ADD CONSTRAINT "OfferComboSlot_position_in_range"
  CHECK ("position" BETWEEN 0 AND 3);

-- 9. A combo cart line is one bowl under the combo's offer, never bought with points. A
--    quantity of 2 would be two bowls charged one share, and a points line has no offer
--    price to share.
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_combo_line"
  CHECK (
    "comboId" IS NULL
    OR ("offerId" IS NOT NULL AND "loyaltyPointsUsed" IS NULL AND "quantity" = 1)
  );

-- 10. An order line from a combo keeps its offer, so a cancellation hands its use back.
ALTER TABLE "OrderDessert" ADD CONSTRAINT "OrderDessert_combo_line_has_offer"
  CHECK ("comboId" IS NULL OR "offerId" IS NOT NULL);
