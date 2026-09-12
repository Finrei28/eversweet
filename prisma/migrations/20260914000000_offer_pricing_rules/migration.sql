-- Offer pricing: exactly one price, and a percentage that is actually a percentage
--
-- Hand-written in full rather than pasted over generated output. Prisma's schema
-- language cannot express a CHECK constraint, so
--   npx prisma migrate dev --create-only --name offer_pricing_rules
-- generates an EMPTY migration here. There is nothing of Prisma's to differ from.
--
-- Consequences of that, all of which matter later:
--   * prisma/schema.prisma does not change, so there is nothing to mirror to the order
--     server and no redeploy is owed. The constraints are invisible to Prisma - a later
--     `migrate diff` reports no drift and will not propose dropping them.
--   * `prisma db push` does NOT run migrations, and that is how the test databases in
--     both repos are built, so neither has these constraints. The rules are enforced
--     there by the zod schema and the router instead, which is the layer the admin
--     actually sees. This is defence in depth against a writer that bypasses both.
--   * The order server never writes an Offer row outside its own tests (checked), so
--     nothing but this repo's admin can trip these.
--
-- The third pricing rule - that a fixed price must come in UNDER the list price of what
-- it covers - is deliberately absent. It compares against Dessert.priceInCents in
-- another table, and a PostgreSQL CHECK constraint cannot contain a subquery. It lives
-- in `assertUnderListPrice` in src/server/api/routers/offers.ts. A trigger could hold it
-- but would also have to fire on Dessert price changes to stay true, and a price edit
-- that fails because of an old offer is a worse failure than the one being prevented.

-- 1. Load-bearing assertion, ahead of the constraints rather than relying on ADD
--    CONSTRAINT to fail. It fails with the offending names in the message; the raw
--    constraint violation names only the constraint, and whoever hits this is midway
--    through a deploy and needs to know which rows to fix.
--
--    All three live offers were audited against these rules before this was written and
--    all three comply: "50% off all drinks" (discountAmount 50), and the two giveaways
--    stored as itemPriceInCents 0. So this is a guard for what arrives later, not a
--    migration that has to clean anything up today.
DO $$
DECLARE bad TEXT;
BEGIN
  SELECT string_agg("name", ', ') INTO bad FROM "Offer"
  WHERE (("itemPriceInCents" IS NULL) = ("discountAmount" IS NULL))
     OR ("discountAmount" IS NOT NULL AND "discountAmount" NOT BETWEEN 1 AND 100)
     OR ("itemPriceInCents" IS NOT NULL AND "itemPriceInCents" < 0);

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION
      'Offer pricing: these offers break the new rules and must be fixed first: %', bad;
  END IF;
END $$;

-- 2. Exactly one way to price an offer, never both and never neither.
--
--    Both set was accepted and the discount silently ignored by the order server, so a
--    row could read "50% off" while every customer was charged the fixed price. Neither
--    set was accepted too: offerUnitPriceInCents falls through to list price, giving an
--    offer that advertises something and discounts nothing.
--
--    `IS NULL <> IS NULL` rather than NUM_NONNULLS, because the columns are nullable
--    integers and a fixed price of 0 is a legitimate value meaning free - both of the
--    shop's giveaway offers are stored that way.
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_exactly_one_price"
  CHECK (("itemPriceInCents" IS NULL) <> ("discountAmount" IS NULL));

-- 3. A percentage between 1 and 100. Below 1 is not a discount, above 100 would pay the
--    customer to order. The column has been a whole-percent Int since
--    20260912000000_offer_window_and_discount_percent; until now only the website's zod
--    schema kept it in range, which is why both consumers clamp defensively on read.
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_discountAmount_is_percent"
  CHECK ("discountAmount" IS NULL OR "discountAmount" BETWEEN 1 AND 100);

-- 4. A fixed price cannot be negative. Zero is free and legal; below zero would credit
--    the customer for ordering.
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_itemPriceInCents_not_negative"
  CHECK ("itemPriceInCents" IS NULL OR "itemPriceInCents" >= 0);
