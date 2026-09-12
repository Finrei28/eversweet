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

### The harness is built — what is left is the two tests

The scratch database exists and the plumbing is proven: a spike drove the real
`offer.updateOffer` through a tRPC caller against it and confirmed the requirement row
kept its id. That spike was removed; what it needed is committed.

**Already in place**

- `eversweet_web_test` on the local PG16 cluster (`C:\pg16test`, 127.0.0.1:5432), schema
  pushed, 31 tables. A *separate* database from the order server's `eversweet_test`:
  both suites truncate, so sharing one would have them clearing each other's rows.
- `TEST_DATABASE_URL` in `.env` (gitignored — set it by hand on another machine).
- `vitest.config.mts` reads it with `loadEnv` at **config** time and swaps it into
  `DATABASE_URL`/`DIRECT_URL`, plus `fileParallelism: false`.
- `src/test/db.ts` — `describeIfDb`, and `resetDatabase` refusing any database whose name
  lacks "test". `src/test/db.test.ts` proves the refusal still bites.

**Read this before writing the tests — four things that will otherwise cost an hour**

1. **`DATABASE_URL` in this repo is production Supabase.** Doing the swap in
   `src/test/setup.ts` looks natural and is wrong: setup runs before `.env` is reliably
   readable, so the override silently no-ops and the first `resetDatabase()` truncates the
   live database. That is `RECOVERY.md` all over again. It is decided in `vitest.config.mts`
   for that reason — leave it there. Assert `DATABASE_URL` contains `eversweet_web_test`
   in any new suite as a third check.
2. **Do not import `~/server/api/root`.** It reaches the order router, which imports an
   email template whose JSX will not compile under the Next `tsconfig`. Build a caller from
   just what is under test:
   ```ts
   const createCaller = createCallerFactory(
     createTRPCRouter({ offer: offerRouter, winner: winnerRouter }),
   );
   ```
3. **Mock two modules** or the file will not even load:
   ```ts
   vi.mock("server-only", () => ({}));               // throws outside an RSC
   vi.mock("~/server/auth", () => ({ auth: vi.fn(async () => null) }));
   ```
   `trpc.ts` imports `auth`, which drags in next-auth → `next/server`, unresolvable under
   Vitest. A hand-built context never calls it, so the stub is free.
4. **The context is just an object.** `protectedProcedure` only checks `ctx.session.user`
   exists, so this is a signed-in admin:
   ```ts
   createCaller({ db, session: { user: { id: "admin-test" }, expires: "2099-01-01" },
                  headers: new Headers() } as never)
   ```
   `WinnerReward.assignedByAdminId` has no foreign key, so that id needs no `User` row.
   `LoyaltyWinner.userId` **does** — create a real user for the happy path.

   Minor: `timingMiddleware` adds a 100–500ms artificial delay whenever `isDev`, and Vitest
   sets `NODE_ENV=test`, so every call pays it. Tolerable for a handful of tests; pass
   `isDev: false` to `initTRPC.create()` if it ever grates.

**The tests to write** (`src/server/api/routers/offers.integration.test.ts` and
`winners.integration.test.ts`, both `describeIfDb` with `resetDatabase()` in `beforeEach`):

1. **Requirements are patched, not replaced** — create an offer with two requirements, edit
   it through `offer.updateOffer` changing a quantity and dropping one, and assert the
   surviving row keeps its original id. This is the whole point of the diff logic, the order
   server joins on those ids, and a regression would be silent. *(Proven by the spike for
   the single-requirement case; the two-requirement and removal cases are still unwritten.)*
2. **`createOffer` round-trips** — requirements created with it come back through
   `offerSelect`, and `renewsWeekly` persists.
3. **Reward guards** — `winner.upsertReward` refuses a winner whose `userId` is null
   ("account has been closed"); refuses a reward with `redeemedAt` set; and on a plain edit
   changes the title while leaving `code` and `assignedByAdminId` untouched.
4. **Only Close run touches redemptions** — seed an `OfferRedemption` with
   `used: 1, status: "REDEEMED"`, then edit, deactivate, reactivate, archive and restore.
   The row must be untouched after every one. This is the guarantee the run lifecycle rests
   on, and the order server now depends on it.

## 2. Offer field semantics are documented by code, not by spec

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
