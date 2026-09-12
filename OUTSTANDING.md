# Outstanding work

From the admin offers + monthly-winner-rewards build (2026-09-11) and the offer run
lifecycle that followed (2026-09-12).

Paths prefixed `eversweet_app/` are in the sibling repo, currently at
`C:\Users\User\OneDrive\Desktop\eversweet_APP\eversweet_app`. See `CLAUDE.md` for how the
two repos share one database.

---

## 1. Offer field semantics are documented by code, not by spec

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

**Admin write paths, now covered — 2026-09-12**

- `src/server/api/routers/offers.integration.test.ts` (9 cases) and
  `winners.integration.test.ts` (7), both `describeIfDb` against `eversweet_web_test`.
  They pin the two guarantees that are invisible from the UI and would otherwise regress
  in silence: `updateOffer` patches an `OfferRequirement` rather than deleting and
  recreating it, so the ids the order server joins on survive an edit; and `closeRun` is
  the *only* procedure that touches a redemption, with edit, pause, resume, archive and
  restore all leaving a seeded row byte-for-byte intact.

  Also covered: the ended-run edit block (including that pushing `endsAt` forward is
  refused, which is the move the whole design exists to stop), the refusal to reactivate
  an ended run, closing a run end to end — rows deleted, `endsAt` cleared, requirements
  kept, editing unblocked — "Show archived" returning archived rows, whole-percent
  `discountAmount` arriving as a number, reward code and original assigner surviving an
  edit made by a *different* admin, the closed-account and already-redeemed refusals, and
  the NZ end-of-day expiry.

- Checked by mutation rather than trusted for going green. Restoring delete-and-recreate
  in `updateOffer`, reset-on-reactivate in `setActive`, and re-minting the code on a
  reward edit each failed exactly the case that names it and nothing else.

- `src/test/caller.ts` carries the shared tRPC caller: the root router cannot be imported
  (it reaches an email template whose JSX will not compile under the Next `tsconfig`),
  `server-only` and `~/server/auth` both need stubbing, and the context is a plain
  object. It takes an admin id so a test can play a second admin.

**Fixed while writing those**

- `itIfDb` added alongside `describeIfDb`. `src/test/db.test.ts` had an unguarded case
  asserting `DATABASE_URL` names the test database, so `npm test` failed on any machine
  without `TEST_DATABASE_URL` — the opposite of the skip-not-fail contract `db.ts`
  promises. A run with no database is now 89 passed, 17 skipped, 0 failed.
- `npm test` added to `.github/workflows/ci.yml`, which ran lint and typecheck only. The
  integration suites skip there for want of `TEST_DATABASE_URL`, so CI covers the unit
  tests — but nothing had been stopping a test regression reaching `main`.
- `types/next-auth.d.ts` intersected the session **user** with `DefaultSession` instead of
  `DefaultSession["user"]`, making `expires` a required field of the user and putting a
  nested `user.user` on the type. Nothing read either; the fix is inert.

**Website (this repo), 2026-09-12**

- `renewsWeekly` wired through `createOfferSchema`, `offerScalars`, `offerSelect`, a
  checkbox in `offerDialog.tsx`, and the table's Limit cell (`1 / week`).
- Every `Offer` query given an explicit `select`, so a client generated ahead of an
  unapplied migration cannot ask for a column the database lacks.
- `20260913000000_offer_renews_weekly` made shadow-safe — its backfill assertion now
  tolerates the empty database `prisma migrate dev` replays into, instead of failing P3006
  every time. Applied with `migrate deploy`; exactly one offer flagged.

**Order server and mobile app (`eversweet_app`)** — verified 2026-09-12

- A spent weekly perk no longer reads as gone for good: `offerCard.tsx` says "Back again
  each Monday" once the allowance is used, driven by `renewsWeekly` now travelling in the
  `showOffers` payload. ("each Monday" rather than "on Monday" — the reset runs Monday
  00:00 NZ, so on a Monday the latter reads as today when it means next week.)
- Every `Offer` and `OfferRedemption` read given an explicit `select`, the same guard this
  repo applies to its own queries, so a client generated either side of an unapplied
  migration cannot ask for a column the database lacks. `showOffers` now asserts its exact
  response shape, since a hand-written select can drop a field the app needs by one line.
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
