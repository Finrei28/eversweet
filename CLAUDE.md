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
npm run check        # lint + typecheck  (CI runs this plus npm test)
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

`db push` syncs from `schema.prisma`, so it creates **no CHECK constraints** - Prisma
cannot express them. To make the test database match production, apply those migrations by
hand (this machine's already has them):

```bash
"C:/pg16test/pgsql/bin/psql.exe" -v ON_ERROR_STOP=1 -d "$TEST_DATABASE_URL"   -f prisma/migrations/20260914000000_offer_pricing_rules/migration.sql
```

Nothing in the suites depends on them - they assert the zod schema and the router, which is
every path an admin can reach - so a database without them still passes.

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

### Deploying

The website deploys to **Vercel**; the order server goes to Render. `next build` lints and
typechecks, so **the build needs devDependencies** - and the way it fails without them is
misleading enough to be worth writing down.

**A deploy never migrates.** `npm run build` is plain `next build`, so a merged migration
reaches production only when someone runs `npm run db:migrate` - and which side of the
Vercel deploy that happens on matters:

- **A migration that adds a column goes first.** Prisma selects every scalar its client
  knows, so a build reading a column the database lacks fails on its first read of that
  table (see the sharp edge on schema changes).
- **A migration that corrects what the old code wrote goes after - if the new build can
  read the uncorrected rows.** Run first, it leaves the old build writing the old shape
  in the gap. But if the new build cannot read that shape, deploying first breaks it until
  the migration runs, so make the new code accept both, deploy, then migrate.
  `20260917000000_offer_ends_through_its_last_day` qualifies as it stands: to both builds
  an uncorrected end is still a valid end, only a day early.
- **The order server deploys before a website build that calls a new internal route** -
  see the architecture section.

**Never set `NODE_ENV` as a Vercel environment variable.** Next sets it itself, `production`
for both `next build` and the deployed runtime, so the variable is redundant. Setting it
makes npm install with `--omit=dev`, and the build dies as:

```
⨯ ESLint must be installed in order to run during builds
Failed to compile.
.eslintrc.cjs:1:19  Type error: Cannot find module 'eslint'
```

Two messages, one fault: eslint is not on disk. The confusing part is the asymmetry.
`typescript` is `dev: false` in the lockfile because a *production* dependency pulls it in
transitively, so it survives the very same install; the build therefore gets far enough to
run `tsc`, and then dies on `.eslintrc.cjs`, which `tsconfig.json` lists in `include` and
whose first line is `/** @type {import("eslint").Linter.Config} */`. Reproduce it without
touching anything:

```bash
npm ci --omit=dev --dry-run --ignore-scripts
```

It prints `remove eslint` and no `remove typescript`. Check the Preview and Development
environments too - a variable set there fails preview deploys the same way. Overriding the
Install Command with `npm ci --include=dev` is the surgical fix; removing the variable is
the correct one.

Beyond the build, what a *runtime* `NODE_ENV` can change is narrower than it looks, and the
part that costs something is tRPC, not this repo's code. Two mechanisms read it, and they are
easy to conflate:

- **This repo's own checks are fixed at build time.** Next replaces `process.env.NODE_ENV`
  with `"production"` in everything `next build` compiles, server code included
  (`next/dist/build/define-env.js`; only `next dev` or `experimental.allowDevelopmentBuild`,
  which `next.config.js` does not set, makes it `"development"`). So `src/env.js` requiring
  `AUTH_SECRET`, `src/server/db.ts` logging queries, the tRPC route handler logging failures
  and `src/trpc/react.tsx`'s logger link all behave as production in any deploy, whatever
  the runtime variable says. `src/env.js`'s zod default of `"development"` applies only where
  nothing inlines and nothing sets the variable - it decides nothing in a deployed build.
- **tRPC's `isDev` reads the process at runtime.** `initTRPC.create()` sets it from
  `globalThis.process.env["NODE_ENV"] !== "production"` - a form the build-time replacement
  does not match - so a runtime where the variable is *unset* counts as development. That is
  the expensive one: `timingMiddleware` in `src/server/api/trpc.ts` adds an artificial
  100-500ms to **every** tRPC call, and tRPC puts the error's **stack trace** in every error
  response the browser receives (`errorFormatter` spreads `shape.data`, which carries it).
  It is also why the router suites pay the delay: Vitest's `NODE_ENV=test` is not
  `"production"`.

`isDev` has no log line - the `[TRPC] … took …ms` lines are unconditional and mean nothing by
themselves, and `prisma:query` lines cannot appear in a deploy at all. The tell is a `stack`
field in a failing tRPC response's `error.data`, in the browser's network tab.

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
  `LoyaltyWinner`, `WinnerReward` and the crons (`settleMonthlyWinners`,
  `renewWeeklyOffers`).

So several models in `schema.prisma` are **authored here but never read here** — `Offer` is
the clearest case. `/admin/offers` is an authoring and reporting surface only; nothing in this
repo prices against an offer. Before changing the meaning of a column, grep the other repo
for it.

**`/admin/winners` reads the database but writes through the order server.** Assigning a
prize and settling a missed month both call the order server rather than touching
`WinnerReward` or `LoyaltyWinner` — see `src/server/api/routers/winners.ts`. The order
server is the only place a prize code is minted, the only place a winner is pushed a
notification, and where every guard lives. This site used to write the reward row itself
with its own copy of the code generator (`src/server/rewardCode.ts`, since deleted) and no
way to push, so prizes assigned here arrived in silence and the two generators had to be kept
identical by hand — a drift would have made every prize from here unredeemable at the counter.
The website still pins a chosen expiry to the end of the Auckland day before sending it,
because interpreting a browser calendar click is this site's concern — and **the day is read
in the browser** (`pickedDay`), then pinned on the server from that date string
(`endOfDayNZ`, both in `src/lib/aucklandDay.ts`). The router used to read the day off the
calendar's `Date` itself, which is
correct on a machine in Auckland and a day early on Vercel, which runs in UTC. An edit that
leaves the date alone sends no expiry, and the order server keeps the deadline it has.

Two outbound channels, both to the order server's `/api/internal` with an `x-service-secret`
header (`ADMIN_SERVER_URL` + `INTERNAL_SERVICE_SECRET`, both optional in `src/env.js`), with
opposite contracts:

- `src/server/notifyAdmin.ts` announces a paid order. **Best-effort** — it never throws, and
  if it fails the order server's cron sweeps the order up instead, because a customer who has
  paid must not wait on the kitchen.
- `src/server/orderServer.ts` (`callOrderServer`) carries the winners writes. **The answer
  is the result** — it throws a `TRPCError` with the order server's own wording, so the
  dialog can show it. An 8s timeout keeps it inside Vercel's default function limit, and a
  retry is safe: a call that committed but timed out leaves a reward the retry edits in place,
  with the same code and no second push. When either variable is unset it refuses out loud.

So **assigning a prize or settling a month locally needs the order server running**, with
`ADMIN_SERVER_URL` pointed at it and a matching `INTERNAL_SERVICE_SECRET`. The order server
must be deployed before a website build that calls a new internal route.

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
(`FormInput` is a project wrapper that reddens the border on error).

**Dialogs reset on close** with a ref holding the previous open state and an effect that
clears when it goes from open to closed. Who owns that open state depends on where the
dialog is opened from:

- **Its own trigger** (`addProduct`, `editProduct`, `editCustomisationDialog`) — local
  `dialogOpen` state, and the ref is `prevDialogOpen`.
- **A table row or toolbar button** (`offerDialog`, `rewardDialog`, `settleMonthDialog`) —
  the parent owns it and passes `open`/`onOpenChange`, because it also has to say *which*
  row. The ref is `prevOpen`, on the prop. Copying the prop into local state as well would
  only add a second source of truth to fall out of step.

A dialog whose mutation can outlive the visit that started it — `settleMonthDialog`, which
waits on the order server — must check that visit is still on screen before showing the
answer in it.

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

- **An offer carries exactly one price: `itemPriceInCents` or `discountAmount`, never both
  and never neither.** `discountAmount` is whole percent 1–100 (an `Int` since the
  2026-09-12 migration; it was previously a `Decimal` fraction where `0.2` meant 20%).
  `itemPriceInCents` is cents and **0 is legal, meaning free** — both giveaway offers are
  stored that way, so null-check it, never truth-check it. A fixed price must also come in
  *under* the list price of what it covers; for a category-scoped offer that means under the
  **cheapest** item in the category, which is the only shape in production.
- **Those rules live in three places and only two of them are the database.** The first two
  are CHECK constraints (`20260914000000_offer_pricing_rules`) *and* `createOfferSchema`;
  the price ceiling cannot be a constraint at all, because it compares against another
  table and PostgreSQL CHECK forbids subqueries — it is `assertUnderListPrice` in the offers
  router, mirrored in `offerDialog.tsx` so the admin is told before submitting. Prisma
  cannot express a CHECK, so the constraints are invisible to it: `migrate diff` reports no
  drift and will not drop them, but **`prisma db push` never creates them**, so a test
  database built that way does not have them (this machine's was given them by hand - see
  the integration-test section - so a raw insert there needs a price). The suites prove the
  application layer either way; the constraints are defence against a writer that bypasses
  it.
- **An offer's dates are whole Auckland days.** `startsAt` is midnight at the start of its
  day and `endsAt` the **last millisecond** of its day (23:59:59.999), and both apps compare
  them inclusively. The dialog sends the days the admin picked as `"2026-10-31"` strings,
  read in the browser with `pickedDay`, and the router pins them with
  `startOfDayNZ`/`endOfDayNZ` (`src/lib/aucklandDay.ts`). It used to store the calendar's
  `Date` as it came — midnight at the *start* of the end day — so every offer stopped a day
  early; `20260917000000_offer_ends_through_its_last_day` moved the rows written that way.
  Never read a day off a `Date` on the server: Vercel runs in UTC, where an Auckland
  midnight is still the day before.
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
