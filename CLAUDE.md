# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The Eversweet **website**: a Next.js 15 App Router app (T3 stack — tRPC, Prisma, NextAuth,
Tailwind) for a Chinese dessert shop in East Auckland. Customers browse the menu and order
and pay online; staff manage products, orders, feedback, offers and monthly prize winners
from `/admin`.

Single store, NZD, GST-inclusive, `Pacific/Auckland` wall-clock time throughout.

## Commands

```bash
npm run dev          # next dev --turbo, port 3000
npm run check        # lint + typecheck, what CI runs
npm run typecheck    # tsc --noEmit
npm run lint         # next lint  (lint:fix to autofix)
npm test             # vitest run (test:watch for watch mode)
npm run format:write # prettier
```

Run a single test file or case:

```bash
npx vitest run src/lib/pickUpTimeHelper.test.ts
npx vitest run -t "expires a September win at the end of October"
```

Vitest is `environment: "node"`, picks up `src/**/*.test.ts`, and `src/test/setup.ts` sets
`SKIP_ENV_VALIDATION=1` so importing a server module is a test failure rather than a crash
on missing env. A test that imports a `server-only` module needs
`vi.mock("server-only", () => ({}))` at the top — see `src/server/notifyAdmin.test.ts`.

CI (`.github/workflows/ci.yml`) runs lint, typecheck and tests on Node 22 with dummy
`DATABASE_URL`/`DIRECT_URL` and `SKIP_ENV_VALIDATION=1`; no database is contacted. The
integration suites below skip there for want of `TEST_DATABASE_URL`, so CI covers the
unit tests only - the router suites run locally or nowhere.

### Integration tests need a database, and `DATABASE_URL` is production

Unit suites need none. Anything exercising a tRPC router does, and the trap here is that
`DATABASE_URL` in `.env` is **production Supabase** — `resetDatabase()` truncates every
table, so getting this wrong is `RECOVERY.md` again from a different direction.

The database is `eversweet_web_test` on the standalone PG16 cluster at `C:\pg16test`,
which the order server's repo also uses — a **separate database** from its
`eversweet_test`, because both suites truncate. It is not a Windows service, so after a
reboot:

```bash
"C:/pg16test/pgsql/bin/pg_ctl.exe" -D "C:/pg16test/data"   -l "C:/pg16test/server.log" -o "-p 5432 -c listen_addresses=127.0.0.1" start
```

`vitest.config.mts` reads `TEST_DATABASE_URL` with `loadEnv` at **config** time and swaps
it into `DATABASE_URL`/`DIRECT_URL`. Do not move that into `src/test/setup.ts`: setup runs
before `.env` is reliably readable, so the override silently no-ops and leaves the client
pointed at production. `src/test/db.ts` refuses to truncate a database whose name has no
"test" in it, as an independent second guard, and `src/test/db.test.ts` proves it still
refuses.

Rebuild the database after a schema change with `prisma db push` — from a scratch
directory whose `.env` holds only the test URL, never from the repo root, where
`db push` would target production.

Testing a router: build a caller from just the routers under test rather than importing
`~/server/api/root`, which reaches the order router and an email template whose JSX will
not compile under the Next `tsconfig`. Mock `server-only` and `~/server/auth` (the latter
drags in next-auth → `next/server`). `protectedProcedure` only checks `ctx.session.user`
exists, so the context is a plain object. `src/test/caller.ts` does all of that once;
`src/server/api/routers/offers.integration.test.ts` is the worked example.

Suites that need the database are wrapped in `describeIfDb` (or `itIfDb` for a lone
case), so a machine without `TEST_DATABASE_URL` skips them rather than failing. Keep new
ones wrapped: an unguarded case there fails `npm test` for everyone who has not set the
database up.

`timingMiddleware` sleeps 100-500ms per call whenever `isDev`, and Vitest sets
`NODE_ENV=test`, so every procedure call in a router suite pays it. A case making five or
six calls needs a raised timeout - `describeIfDb("...", { timeout: 30_000 }, ...)`.

### Running the app

Prefer the Browser pane over a bare `npm run dev` — `.claude/launch.json` defines an
`eversweet-dev` config. `/admin` returns **404** without a session (not a redirect); sign in
first at `/api/auth/signin`, which is NextAuth's default page as no custom one exists.

## This repo owns the database schema — and another repo shares it

The mobile apps and the order server live in a **separate repo**, currently at
`C:\Users\User\OneDrive\Desktop\eversweet_APP\eversweet_app` (its own `CLAUDE.md` documents
this from the other side):

| Directory   | What it is                                                          |
| ----------- | ------------------------------------------------------------------- |
| `backend/`  | Express + Prisma + Socket.IO "order server". Deployed to Render.     |
| `frontend/` | Customer Expo app.                                                   |
| `admin/`    | Staff kitchen Expo app — order alarms, BLE receipt printing.         |

**One PostgreSQL database (Supabase), two codebases, one migration history — and the
history lives here.** `backend/prisma/` has no `migrations/` directory and is not meant to:
migrations run from this repo only. What *is* shared is the schema — the two
`prisma/schema.prisma` files are kept **byte-for-byte identical** (`cmp -s` them if unsure).

So a schema change is: edit and migrate here, copy `prisma/schema.prisma` across, then
`npx prisma generate` in `backend/`. Copying the schema without regenerating, or
regenerating without deploying, leaves that service's client describing columns the
database does not have — Prisma selects every scalar by default, so the next read of that
table fails.

Mind the version skew: this repo declares Prisma `^5.14` (5.22 installed), the order server is
on 6.19. Migrations are authored here, so don't reach for 6.x-only syntax.

### Database commands, and the one that will ruin your day

```bash
npm run db:generate   # prisma migrate dev      — local/dev
npm run db:migrate    # prisma migrate deploy   — production, never resets
npm run db:studio     # prisma studio
npx prisma migrate status   # read-only: is anything pending?
```

`DATABASE_URL` is the pooled Supabase connection, `DIRECT_URL` the direct one. DDL through
the pooler is unreliable, so migrations use `DIRECT_URL`.

> **Never pass a real database URL to `--shadow-database-url`.** A shadow database is
> scratch space Prisma is free to destroy: `migrate diff --from-migrations` drops the target's
> entire public schema, replays every migration into it, and discards `_prisma_migrations`.
> Pointed at production on 2026-09-11 it wiped the live database (see `RECOVERY.md`).
> `--from-migrations` has **no** read-only variant.
>
> To compare the live database against the schema, use `--from-schema-datasource`, which
> introspects read-only and needs no shadow database:
>
> ```bash
> npx prisma migrate diff \
>   --from-schema-datasource prisma/schema.prisma \
>   --to-schema-datamodel prisma/schema.prisma --script
> ```
>
> Usually `npx prisma migrate status` is all you actually need.

**`migrate dev` builds its own shadow database too.** It creates a throwaway database and
replays every migration into it from nothing before touching the target, which is why
`DATABASE_URL` here must never point somewhere you mind losing — and why this repo uses
`migrate deploy` against the shared database. `deploy` uses no shadow database at all.

That replay also means **a migration's assertions run against an empty database**. Anything
data-dependent has to tolerate zero rows or `migrate dev` fails with P3006 forever, for
everyone. Guard on the table being non-empty rather than dropping the assertion — see
`20260913000000_offer_renews_weekly`, where the backfill matches one named offer that does
not exist in a freshly replayed shadow.

### Migration house style

Hand-written SQL, pasted over the body of `prisma migrate dev --create-only` output. The
header says what Prisma's generated SQL would have done and why this differs; then
add → backfill → **assert** → drop, with the assertion load-bearing. Prisma wraps each
migration in a transaction, so a failed assertion rolls the whole thing back rather than
leaving a half-migrated table. Name new indexes and constraints the way Prisma would, so a
later `migrate diff` reports empty instead of proposing a rebuild. A purely additive
migration says explicitly that it has nothing to assert against.

Reference: `prisma/migrations/20260908000000_offer_audience_and_redemption_rekey/`.

## Architecture

`~/*` maps to `src/*`.

### Two consumers, different jobs

- **This website** serves its own customers and the `/admin` dashboard, and prices carts
  itself with `Promo`.
- **The order server** serves the mobile apps: `Offer`, `Membership`, `Loyalty`,
  `LoyaltyWinner` and the crons (`settleMonthlyWinners`, `renewMochiOffer`).

So several models in `schema.prisma` are **authored here but never read here** — `Offer` and
`WinnerReward` are the clearest cases. `/admin/offers` and `/admin/winners` are authoring and
reporting surfaces only; nothing in this repo prices against an offer or redeems a reward
code. Before changing the meaning of a column, grep the other repo for it.

The only outbound call is `src/server/notifyAdmin.ts`, which POSTs a paid order to the order
server's `/api/internal/orders/announce` with an `x-service-secret` header
(`ADMIN_SERVER_URL` + `INTERNAL_SERVICE_SECRET`, both optional in `src/env.js`). It is
best-effort — if it fails, the order server's cron sweeps the order up instead.

### Auth is the admin gate

`src/server/auth/config.ts` uses a Credentials provider whose `authorize()` returns `null`
unless `user.role === "ADMIN"`. **Customers cannot authenticate on this website at all.**
Consequently `protectedProcedure` *is* the admin gate — there is no `adminProcedure`, and
nothing reads `session.user.role` for authorisation. New admin routers should carry a comment
saying so; if a customer login is ever added here, every protected procedure becomes an open
door. Pages gate themselves with `const session = await auth(); if (!session?.user) return notFound();`.

Note `product.ts`'s `getProductsForAdminByCategory` is a `publicProcedure` despite the name —
"admin" in a procedure name is not a reliable signal.

### Pricing

`src/server/pricing.ts` is the single source of truth for what a cart costs, and it is
`server-only`. Prices are always re-derived from the database; never trust a price from the
browser. `priceCart()` throws `CartPricingError` for missing or unavailable items.
`isPromoActive` delegates to `isWithinActiveWindow` in `src/lib/activeWindow.ts`, shared with
offers so the two cannot drift.

### Caching

`unstable_cache` wrappers live at module scope (so they wrap once, not per request) and use
the `db` singleton directly. Product mutations `revalidateTag(MENU_CACHE_TAG)`. The Next data
cache does not preserve `Date`, so ISO strings cross the boundary and are rehydrated — see
`src/server/api/routers/store.ts`.

## Admin UI conventions

Read an existing page before writing a new one; these are load-bearing.

**Page** — server component: `auth()` → `notFound()` → prefetch → `<HydrateClient>` →
`<Suspense fallback={<Loader text="…" />}>`.

**`await` the prefetch, never `void` it.** A pending dehydrated promise makes the Suspense
boundary suspend on the server; its content then streams in after the shell, and React gives
streamed-in content `useId` tree ids that do not match the ones hydration computes. Every
Radix `useId` inside the boundary mismatches and React discards and re-renders the subtree.
Use `Promise.all` when a page prefetches several queries. `prefetch` and `useSuspenseQuery`
must be called with **identical** inputs or the cache key misses.

**Table** — TanStack Table v8 + shadcn `Table`; data via `const [x] = api.a.b.useSuspenseQuery()`.
Columns are a hook-style `export function GetXColumns(): ColumnDef<T>[]` that calls
`useLanguage()` and **returns a `useMemo`**. Without the memo every render rebuilds the inline
`cell` closures; `flexRender` calls those as components, so a new identity is a new component
type and React remounts every cell — closing any open row menu. Handlers passed in must be
`useCallback`'d, and destructure `mutate` out of a mutation rather than depending on the
mutation object, whose identity changes with its own state.

**Any derived `data` array must be memoised** before it reaches `useReactTable`. TanStack's
`autoResetPageIndex` watches `data` by reference, so an unmemoised `.filter()` sets state on
every render and loops until the tab freezes. See the comment in
`src/app/admin/offers/data-table.tsx`.

**Forms** — react-hook-form + `zodResolver`; schemas live centrally in
`src/app/components/schemas.tsx`. Controls come from `~/components/ui/form`
(`FormInput` is a project wrapper that reddens the border on error). Dialogs use local
`dialogOpen` state and a `prevDialogOpen` ref effect to reset on close.

**Mutations** — `api.useUtils()` + `await utils.<router>.invalidate()` in `onSuccess`, then
`toast()` from `~/hooks/use-toast`. Never `router.refresh()`.

**Bilingual** — no translation files. Every user-visible string is inline
`{language === "en" ? "…" : "…"}` via `useLanguage()`, which throws outside its provider, so
any component using it must be a client component. `language` starts `"en"` and is corrected
from `localStorage` in an effect; a brief English flash on first paint is accepted.

**No `alert-dialog` primitive exists.** Confirmations are composed from `Dialog` (or
`src/app/components/customDialog.tsx`) with a `variant="destructive"` button. There is no
date-picker primitive either — `src/app/components/dateField.tsx` composes Popover +
Calendar + Button, and its Clear button matters because most dates here are nullable.

Adding an admin page means adding a `<NavbarLink>` in `src/app/admin/layout.tsx`. The desktop
nav is `hidden xl:flex` inside a `max-w-7xl` container with the logo **absolutely positioned**
— the link row centres across the full width without knowing the logo is there, so admin
reserves the logo's width (`pl-64`) and tightens the gap. Check any new link at 1280px.

## Sharp edges

- **`Offer.discountAmount` is whole percent, 0–100** (an `Int` since the 2026-09-12 migration;
  it was previously a `Decimal` fraction where `0.2` meant 20%). `itemPriceInCents` overrides
  it when both are set.
- **`Offer.renewsWeekly` makes `limit` an allowance per week rather than per run.** The order
  server's `renewWeeklyOffers` cron clears `used` every Monday for exactly those offers. It
  used to be an `updateMany` with no WHERE clause, which reset every redemption row in the
  database — including requirement-gated offers a shop had deliberately closed the run on.
- **A schema change is not done until the order server is redeployed.** Prisma selects every
  scalar its client knows about, so a client built from a newer schema than the database asks
  for columns that do not exist and the read fails outright. Mirror the schema, regenerate,
  deploy — and give every query an explicit `select` so the blast radius is small when the two
  do drift.
- **Offers are never hard-deleted.** `OrderDessert.offer` and `CartItem.offer` both cascade
  *from* `Offer`, so deleting one takes the order lines that used it — and the sales history —
  with it. `OfferRequirement.offer` is RESTRICT, so a delete throws or eats history depending
  on unrelated state. Archive (`archivedAt`) instead.
- **`OfferRedemption.status` has no `@default`** — any `updateMany` touching those rows must
  set it explicitly.
- `relationLoadStrategy: "join"` needs the `relationJoins` preview feature (enabled) and works
  on `findMany`/`findUnique` only. Without it Prisma issues one query per relation, each a
  fresh ~160ms round trip to a remote database.
- Image uploads POST FormData to `/admin/products/api/uploadImage` (Cloudinary,
  content-hash deduped). It files everything under `products/` and returns a public id that
  some callers discard.
