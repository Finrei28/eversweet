# Outstanding work

From the admin offers + monthly-winner-rewards build (2026-09-11) and the offer run
lifecycle that followed (2026-09-12).

Paths prefixed `eversweet_app/` are in the sibling repo, currently at
`C:\Users\User\OneDrive\Desktop\eversweet_APP\eversweet_app`. See `CLAUDE.md` for how the
two repos share one database.

---

## Open

From the hold-then-capture work (2026-09-18).

**One thing to check in Stripe, once** - unless it was done before the sweep first ran

The order server's sweep refunds a captured website payment that has had no `Order` row for
half an hour, looking back 48 hours. Its first run in production therefore reaches payments
that were taken before any of this shipped, and some of those were settled by hand in the
shop: the order was made and handed over, the row never written. Look over the refunds the
sweep has issued and make sure none of them is one of those. Nothing to do if the check was
made before deploying, which is what the deploy notes asked for.

**A confirmation email Resend refuses is never sent again**

`createNewOrder` sends the order confirmation through Resend and only logs a refusal. The
call still succeeds, the customer lands on their order page, and nothing ever tries again.
The other half of this is closed: a call that committed its order and then died is repaired
when the checkout retries, because the announcement and the email both run again, the email
keyed `order-confirmation:<orderId>` so Resend cannot send a second. A refusal has no repair.

That repair is also bounded to an hour after the order was written (`followUpStillDue`),
because the key is only honoured for 24 hours and this mutation is public - a checkout
resumed the next day would otherwise send a second confirmation. So a retry that comes later
than an hour repairs nothing either. Both gaps close the same way.

Closing it means recording the work durably - a column on `Order` (say `confirmationSentAt`)
set when the send succeeds, and something that sweeps rows without one. The website runs no
timer of its own, so that sweep belongs with the order server's crons, which already carry
`sweepStrandedPayments` and read the same database.

So it is a schema change: a migration here, `prisma/schema.prisma` mirrored into
`eversweet_app/backend/`, `npx prisma generate` there, and that service deployed before the
column is read (see `CLAUDE.md`). Worth folding into the next change that already takes both
repos through one. Until then the kitchen still gets the order and the customer still sees it
on screen; only the email is missing.

Two properties are known and accepted rather than outstanding:

- **No test database has the CHECK constraints.** `prisma db push` does not run
  migrations, and that is how both repos build their test databases. The suites prove the
  zod schema and the router, which is every path an admin can reach; the constraints are
  defence against a writer that bypasses both.
- **The price ceiling is not re-checked on existing offers.** Drop a dessert's price below
  an old offer's fixed price and that offer is no longer under it. Enforcing this would
  mean failing an unrelated price edit because of an old offer, which is a worse failure
  than the one it prevents.

---

## Done

Everything below was outstanding during the build and has since shipped. Kept as a record
of what the two repos had to agree on, and of what a schema change costs when it is only
half-deployed.

**The website's payments: held, checked, then captured — 2026-09-18**

Merged as [`Finrei28/eversweet#19`](https://github.com/Finrei28/eversweet/pull/19) and
[`Finrei28/eversweet_app#32`](https://github.com/Finrei28/eversweet_app/pull/32), the order
server first. Two holes closed, both from the website never comparing what was paid with what
was ordered: `createNewOrder` recorded any payment id it was handed without asking Stripe, and
the checkout never repriced its payment after the cart was edited.

- The card is **held** when the customer pays and captured as the last step before the order
  commits, only for exactly what the server prices the cart at. Anything else lets the hold
  go. `src/server/websiteOrder.ts`, under the same advisory lock and idempotency keys the
  order server uses.
- The payment follows the cart: every edit reprices it, and so does pressing Pay, so a price
  that moved or an item that sold out is caught before the card is touched.
- Every failure is worded for the customer in both languages, and a retry finishes what a
  call that died never did - bounded to an hour, since the email's idempotency key is.
- The order server's sweep settles website payments too, finding them by charge and judging
  them by when the money was captured.

The pricing section of `CLAUDE.md` carries the rules; three review rounds narrowed the sweep's
clock from the payment intent to the charge to the capture, so read that section before
changing any of those windows.

**Offer pricing rules — 2026-09-12**

- `20260914000000_offer_pricing_rules` applied to production. All three CHECK constraints
  are live and the migration is recorded; the live rows were audited against it first and
  all three complied, so it applied cleanly.

- An offer now carries exactly one price. Both set was accepted and the discount silently
  ignored, so a row could read "50% off" while every customer paid the fixed price;
  neither set was accepted and priced at list. `discountAmount` is 1-100, and a fixed
  price has to come in under the list price of what it covers - for a category-scoped
  offer, under the **cheapest** item in it, which matters because all three live offers
  are category-scoped.
- A fixed price of **0 stays legal and means free**: both giveaway offers are stored that
  way, so the "positive integer" reading would have made them unsaveable and the
  constraint unappliable.
- Split across the layers that can actually hold each rule: CHECK constraints and zod for
  the two single-row rules, `assertUnderListPrice` in the router for the price ceiling,
  which compares against another table and so cannot be a constraint. The dialog mirrors
  the ceiling and names the item that sets it, so the admin is told while typing.
- Checked in the browser against the live database: the hint reads "A fixed price has to
  be under $9.99, what Black Sesame Bowl normally costs", and all three refusals fire
  without a mutation reaching the server. Nothing was written - still exactly three
  offers.

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
