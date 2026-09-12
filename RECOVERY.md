# Data loss 2026-09-11 — post-incident record (resolved)

## What happened

At roughly **17:36 NZST on 2026-09-11**, this command was run against the production
Supabase database:

```
npx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "<production DIRECT_URL>" --script
```

`--shadow-database-url` names a **scratch** database that Prisma is free to destroy.
To answer "what schema do these migrations produce?" it drops the target's public
schema, replays all 85 migrations into it, introspects the result, prints the diff, and
discards its bookkeeping. Pointed at production, it did all of that to production.

It was run by Claude, in the course of verifying that `prisma/schema.prisma` matched the
migration history after a legitimate `prisma migrate deploy`. The `migrate deploy` was
not the cause.

**Evidence it was the diff and not the migration:**

- `migrate deploy` only applies pending migrations; it never resets.
- The migration applied that day (`20260912000000_offer_window_and_discount_percent`)
  contains only `ALTER TABLE` statements against `Offer` and `OfferRedemption`. No
  statement in it can empty `Dessert`, `Order` or `User` — and those are empty.
- `_prisma_migrations` was **gone** afterwards. `migrate deploy` writes a row to that
  table and never drops it. Only the shadow-database lifecycle removes it. That is the
  fingerprint.

**State immediately after:** all 31 tables present and structurally correct, every one
empty, `_prisma_migrations` missing.

**Last known-good moment:** ~17:23 NZST (05:23 UTC) 2026-09-11 — verified by direct
query: 2 offers, 1 redemption, 1 requirement, 2 loyalty winners, 0 rewards, plus a full
menu and order history.

## Outcome

**Resolved by a paid Supabase restore to the previous night's backup ($25).** The
database came back with 6 users, 64 desserts, 10 categories, 26 ingredients, 21 orders,
2 offers, 1 redemption, 2 loyalty winners and 3 feedback rows, and
`prisma migrate status` reports the schema up to date.

The window between that backup and the wipe (~17:36 NZST 2026-09-11) is still lost —
most likely a day of orders. Worth reconciling those 21 orders against Stripe.

## Recovery status

### Superseded — the cache salvage

Before the restore, a `prisma/restoreMenu.ts` + `prisma/recovered-menu.json` pair was
built from the Next.js data cache (`.next/cache/fetch-cache`), which still held the
`getProductsForMenuByCategory` and `prep-times` payloads from before the wipe.

**Both files have since been deleted.** The Supabase restore returned strictly more than
they held — 64 desserts and 26 ingredients against the cache's 63 and 25, because the
menu cache only contains *purchasable* items and so never held anything hidden. The
salvage is recorded here only as a note on what that cache is worth in an emergency.

What it held, for the record: 10 categories, 63 desserts, 25 ingredients and all
dessert-to-ingredient links, with original cuids, both names, prices and Cloudinary URLs
intact, plus the prep-time settings row (5 / 10 / 15 / 20, slack 1, floor 10).

Worth knowing if this is ever needed again:

- The cache keeps `imagePath` but not `imagePublicId`. The public id is recoverable from
  the URL - the segment after `/upload/v<version>/` - and resolved for all 63. Some
  legitimately carry a doubled `products/products/` prefix, which is what the upload
  route actually stores.
- `priceInLoyaltyPoints` is not cached at all and would have fallen back to the schema
  default of 500.
- Everything in that cache came from the customer-facing menu query, so it can only tell
  you about purchasable items. Hidden desserts are absent entirely, and restored ones
  would all come back visible.

### Captured from the session transcript before the restore

All of this came back with the backup and is recorded only as corroboration that the
restore is complete.

**Offers** (2, both `isActive: true`, `discountAmount: null`, `itemPriceInCents: 0`,
`limit: 1`):

- `Buy 4 Mochi Bowls and get one for free`
- `Free weekly mochi dessert bowl`

Plus 1 `OfferRequirement` and 1 `OfferRedemption` row.

**LoyaltyWinner** (2), both with no `WinnerReward` attached:

| month | place | winner | points |
|---|---|---|---|
| July 2026 | 1 | fin Wong | 900 |
| June 2026 | 1 | fin Wong | 14257 |

**DaysOff**: at least one entry, `2026-09-07T12:00:00.000Z`.

### What the backup did not cover

The restore is to the previous night, so writes between that snapshot and ~17:36 NZST on
2026-09-11 are gone for good. In practice that means a day of trading:

| Data | Where to reconcile from |
|---|---|
| `Order` / `OrderDessert` / `OrderDessertCustomisation` from that day | Stripe payment intents — amount, currency, timestamp, customer, metadata |
| `User` accounts created that day | Stripe customers; Resend send history |
| `Loyalty` points earned or spent that day | Derivable from reconstructed orders if the earn rate is known; spent points are not |
| `Feedback` left that day | Not recoverable |
| Live `Cart` / `CartItem` contents | Not recoverable; customers rebuild them |

Nothing here needed reconstructing from the menu cache in the end — the backup was
strictly better.

## Still outstanding

The schema changes that landed alongside this incident are only half-shipped: the order
server and mobile app have not been updated for the new `discountAmount` unit or the new
scheduling columns. That work, and everything else left over, is tracked in
[`OUTSTANDING.md`](./OUTSTANDING.md) — it is pending work rather than part of this incident
record, and it outlives this file.

## Preventing a repeat

- **`--shadow-database-url` must never be given a production URL.** There is no safe way
  to pass it one. `--from-migrations` *always* needs a shadow database and always wipes
  it — that form has no read-only variant. Point it at a throwaway
  (`postgresql://…/shadow`) or don't use it.
- **The safe way to compare the live database against the schema** is
  `--from-schema-datasource`, which introspects the database read-only and needs no
  shadow database at all:

  ```bash
  npx prisma migrate diff \
    --from-schema-datasource prisma/schema.prisma \
    --to-schema-datamodel prisma/schema.prisma \
    --script
  ```

- **`npx prisma migrate status`** answers "is anything pending?", is read-only, and was
  already sufficient here. It had in fact already been run and reported exactly one
  pending migration; the destructive check added nothing.
