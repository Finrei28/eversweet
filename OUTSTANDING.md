# Outstanding work

From the admin offers + monthly-winner-rewards build (2026-09-11) and the offer run
lifecycle that followed (2026-09-12).

Paths prefixed `eversweet_app/` are in the sibling repo, currently at
`C:\Users\User\OneDrive\Desktop\eversweet_APP\eversweet_app`. See `CLAUDE.md` for how the
two repos share one database.

---

## 1. Admin write paths not fully exercised

**Status:** read paths and the run lifecycle are verified against the live database; two
mutations have never been run.

Verified in the browser against real data: both tables render, dialogs open and load stored
values, the requirements editor round-trips an existing row, an ended offer has Edit
disabled and Close run offered, and Close run itself was proven end to end on a throwaway
offer — rows deleted, `isActive` false, `endsAt` cleared, editing unblocked, count correct —
before being cleaned up.

Not yet run against a database:

| Untested | Note |
| --- | --- |
| `offer.createOffer` / `offer.updateOffer` | the dialog was opened and cancelled, never saved |
| `winner.upsertReward` | would mint a real prize code against a real winner |

Worth proving before trusting in production, ideally on a scratch database:

1. **Requirements are patched, not replaced** — edit an offer and confirm its
   `OfferRequirement` row ids are unchanged. That diff logic in `updateOffer` is the whole
   reason the order server can rely on those ids, and a regression would be silent.
2. **Reward guards** — a winner whose `userId` is null refuses assignment; a reward with
   `redeemedAt` set refuses edits; the code does not change on edit.

## 2. `renewsWeekly` is invisible to the customer

The admin can now flag an offer as renewing weekly, and `renewWeeklyOffers` resets exactly
those offers every Monday. Nothing tells the *customer* that: the app shows a greyed
"Redeem" button once the allowance is spent, with no copy saying it comes back on Monday —
`eversweet_app/frontend/_components/offerCard.tsx`.

## 3. Offer field semantics are documented by code, not by spec

`itemPriceInCents` takes precedence over `discountAmount` — true in
`eversweet_app/backend/src/controllers/cart.controller.ts`, but written down nowhere as a
rule. The admin form exposes both with a non-blocking hint rather than a validation rule,
deliberately: any rule stricter than the column itself would stop an offer that is
*running right now* from loading into its own edit form, and that failure only shows up
against production data.

If the precedence is ever formalised, tighten the schema with a migration in the house
style rather than enforcing it only in the UI.

---

## Done

Everything below was outstanding during the build and has since shipped. Kept as a record
of what the two repos had to agree on, and of what a schema change costs when it is only
half-deployed.

**Website (this repo), 2026-09-12**

- `renewsWeekly` wired through `createOfferSchema`, `offerScalars`, `offerSelect`, a
  checkbox in `offerDialog.tsx`, and the table's Limit cell (`1 / week`).
- Every `Offer` query given an explicit `select`, so a client generated ahead of an
  unapplied migration cannot ask for a column the database lacks.
- `20260913000000_offer_renews_weekly` made shadow-safe — its backfill assertion now
  tolerates the empty database `prisma migrate dev` replays into, instead of failing P3006
  every time. Applied with `migrate deploy`; exactly one offer flagged.

**Order server and mobile app (`eversweet_app`)** — verified 2026-09-12

- Schema mirrored **and committed**, so the deployed client no longer declares the dropped
  `renewsAt` column. That mismatch had been breaking the offers screen and offer
  add-to-cart, because Prisma selects every scalar it knows about.
- `discountAmount` read as whole percent throughout: the `.toNumber()` serialisation is
  gone and `offerCard.tsx` renders `{offer.discountAmount}% off`.
- `startsAt` / `endsAt` / `archivedAt` enforced — `isOfferLive(offer)` now gates the cart
  repricing path that previously honoured nothing but `isActive`, with integration tests
  covering the paused, expired and archived states.
- `status` only becomes `REDEEMED` at the limit (`statusAfter(used + 1)`), so `limit > 1`
  finally means something on a requirement-gated offer.
- `renewMochiOffer` → `renewWeeklyOffers`, scoped to
  `{ offer: { renewsWeekly: true, archivedAt: null } }` with its own integration tests. It
  was previously an `updateMany` with no WHERE clause, resetting every redemption row in
  the database each Monday.
- `redeemOfferForUser`'s create branch now throws `OfferUnavailableError` when the offer
  has requirements, closing the hole where a gated offer could be redeemed once by POSTing
  its id directly.

The 2026-09-11 data-loss incident and its prevention rules are in `RECOVERY.md`.
