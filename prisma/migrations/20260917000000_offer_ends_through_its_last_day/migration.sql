-- End an offer at the end of the day it names, not the start of it
--
-- Data only. There is no schema change, so `prisma migrate dev --create-only` would
-- generate an empty migration and this file is the whole of it. Apply with
-- `npm run db:migrate` (migrate deploy); see CLAUDE.md before running anything else.
--
-- Why. The offer dialog's calendar hands back midnight at the *start* of the day picked,
-- and until this release the router stored that as it came. Both apps compare `endsAt`
-- inclusively - the website's isWithinActiveWindow and the order server's isOfferLive and
-- liveOfferWhere - so an offer set to end on 31 October stopped being served at 00:00 on
-- the 31st: a day early. The router now stores the last instant of the day picked,
-- 23:59:59.999 in Auckland. This moves the rows written the old way onto that meaning, so
-- `endsAt` means one thing in every row and neither app has to guess which kind it has.
--
-- Which rows. Exactly those whose `endsAt` is midnight on the Auckland calendar, to the
-- millisecond. That is the fingerprint of a date picked in an Auckland browser; an end
-- written any other way is left as it is. `startsAt` needs nothing: midnight at the start
-- of the day is already what a start date means, and it is what the router still writes.
--
-- Know this before deploying: an offer whose stored end is midnight at the start of
-- *today* has already stopped under the old reading, and after this it runs until the end
-- of today. That is the date the admin chose, but a customer can see the change.
--
-- The columns are TIMESTAMP(3) holding UTC, which is how Prisma writes a DateTime, hence
-- `AT TIME ZONE 'UTC'` before every conversion to Auckland. None of it depends on the
-- session's TimeZone setting.

-- 1. Remember which rows move, and where they were, for the assertion in step 3.
CREATE TEMPORARY TABLE "_offer_end_before" AS
SELECT "id", "endsAt"
FROM "Offer"
WHERE "endsAt" IS NOT NULL
  AND (("endsAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Pacific/Auckland')::time = '00:00:00';

-- 2. Move each to the last millisecond of the same Auckland day: midnight at the start of
--    the next Auckland day, less one millisecond. Worked on the Auckland calendar rather
--    than by adding 24 hours, which lands an hour out on the two days a year the clocks
--    change.
UPDATE "Offer" AS o
SET "endsAt" = (
  (
    (
      (((b."endsAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Pacific/Auckland')::date + 1)::timestamp
      AT TIME ZONE 'Pacific/Auckland'
    ) AT TIME ZONE 'UTC'
  ) - INTERVAL '1 millisecond'
)
FROM "_offer_end_before" AS b
WHERE o."id" = b."id";

-- 3. Assert every moved row landed on the last millisecond of the day it was already on,
--    and that no end is left at midnight. Load-bearing: the conversion above is four
--    nested time zone casts, and one of them the wrong way round moves an end by 13 hours
--    rather than a day - which would still look plausible in the admin table.
--
--    Both checks hold trivially on an empty table, which is what `prisma migrate dev`
--    replays this into when it builds its shadow database. Nothing to guard.
DO $$
DECLARE
  moved INTEGER;
  misplaced INTEGER;
  still_midnight INTEGER;
BEGIN
  SELECT COUNT(*) INTO moved FROM "_offer_end_before";

  SELECT COUNT(*) INTO misplaced
  FROM "Offer" AS o
  JOIN "_offer_end_before" AS b ON b."id" = o."id"
  WHERE ((o."endsAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Pacific/Auckland')::date
          <> ((b."endsAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Pacific/Auckland')::date
     OR ((o."endsAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Pacific/Auckland')::time
          <> '23:59:59.999';

  IF misplaced > 0 THEN
    RAISE EXCEPTION
      'offer end dates: % of % moved offer(s) did not land on 23:59:59.999 of the same Auckland day', misplaced, moved;
  END IF;

  SELECT COUNT(*) INTO still_midnight
  FROM "Offer"
  WHERE "endsAt" IS NOT NULL
    AND (("endsAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Pacific/Auckland')::time = '00:00:00';

  IF still_midnight > 0 THEN
    RAISE EXCEPTION
      'offer end dates: % offer(s) still end at midnight at the start of a day', still_midnight;
  END IF;
END $$;

DROP TABLE "_offer_end_before";
