-- Lets an offer be unlocked by a minimum spend: "spend $20 in one order, and get half price
-- on a bowl next time".
--
-- Written by hand in place of:
--   npx prisma migrate dev --create-only --name offer_requirement_min_spend
-- run from C:\Personal Projects\eversweet
--
-- Prisma would generate step 2 alone. A requirement could only ask for so many of a
-- dessert or so many from a category, so an offer gated on what an order costs had no way
-- to be written down.
--
-- The amount sits on the requirement row, beside the dessert and category, rather than on
-- Offer. Every reader asks "is this offer gated?" as "does it have a requirement" - the
-- order server's unlock pass (`requirements: { some: {} }`) and add-to-cart gate, the
-- customer app's Redeem button, the website's app-offer pop-up - and a spend row answers
-- that with no change to any of them. A column on Offer would have been an offer the
-- unlock pass never looks at, and one every installed app build offers to redeem.
--
-- Rollout: this migration first, then the order server, then this site. A Prisma client
-- built from this schema selects the column on any `offerRequirement` read and fails with
-- "column does not exist" against a database without it. An order server older than the
-- spend check reads a spend row as naming nothing and never unlocks the offer, so no
-- spend offer should be made until it is deployed. Installed app builds name a dessert or
-- category requirement and say nothing of a spend; the offer's description has to.

-- 1. Load-bearing assertion, ahead of the constraint in step 3 rather than relying on ADD
--    CONSTRAINT to fail, so whoever hits it mid-deploy is told which offers to fix. Until
--    now only the website's zod schema held a requirement to exactly one of a dessert or a
--    category; a row naming neither has never unlocked anything, and one naming both was
--    read as its dessert. The copy of production's offers in eversweet_dev complies, so
--    this is expected to pass.
--
--    Over an empty table - a shadow database, or `migrate deploy` building a fresh local
--    one - the aggregate is NULL and it passes.
DO $$
DECLARE bad TEXT;
BEGIN
  SELECT string_agg(DISTINCT o."name", ', ') INTO bad
  FROM "OfferRequirement" r
  JOIN "Offer" o ON o."id" = r."offerId"
  WHERE ((r."dessertId" IS NULL) = (r."categoryId" IS NULL));

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION
      'OfferRequirement: these offers have a requirement naming both a dessert and a category, or neither, and must be fixed first: %', bad;
  END IF;
END $$;

-- 2. The amount, in cents like every other price here. Nullable: it is set only on a
--    spend row, and every existing row is a dessert or category one.
--
-- AlterTable
ALTER TABLE "OfferRequirement" ADD COLUMN     "minSpendInCents" INTEGER;

-- 3. Exactly one of the three. The order server checks a row by whichever it names first,
--    so a row naming a dessert and a spend would quietly be a dessert requirement.
--    NUM_NONNULLS takes columns of different types, which `IS NULL <> IS NULL` cannot
--    chain past two.
ALTER TABLE "OfferRequirement" ADD CONSTRAINT "OfferRequirement_exactly_one_target"
  CHECK (NUM_NONNULLS("dessertId", "categoryId", "minSpendInCents") = 1);

-- 4. A spend of nothing would unlock the offer on every paid order, which is an offer with
--    no requirement written the long way round.
ALTER TABLE "OfferRequirement" ADD CONSTRAINT "OfferRequirement_minSpendInCents_positive"
  CHECK ("minSpendInCents" IS NULL OR "minSpendInCents" > 0);
