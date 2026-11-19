# The customer website on direction D

Rollout step 5 of the Eversweet redesign: the customer pages of this website move onto the
customer app's design direction D, from the same token values. The app was redesigned flow by
flow in September 2026 (`eversweet_app` PRs #46-#53); its design system is the
`eversweet-design` skill in `eversweet_app/frontend/.claude/skills/eversweet-design/`, and that
skill is the brief here too.

Agreed with the owner on 2026-11-20. Nothing below has been built yet.

- **Mock-ups:** https://claude.ai/artifact/3fkVCikxmMexE61A6XG6Fw ("Eversweet website,
  direction D"). Home, the menu, the customise dialog, the cart, checkout and order confirmed at
  1440 and 390 wide, contact (desktop), feedback (phone), and a sheet of the shared tokens.
  Approved as drawn.
- **The app's reference mock-ups:** row D of https://claude.ai/artifact/1sgq94n5fLEHzTSpjF1uX7.

## The decisions

1. **Build the mock-ups as drawn**, defaults included (below).
2. **Names in the reader's language first.** Every dessert, category and customisation name shows
   in both languages. In English the English name leads, larger, with the Chinese under it or
   beside it; in Chinese the Chinese name leads and the English follows. The leading name takes
   the leading style (its size, ink); the other takes the second style (smaller: red bean beside
   a heading, muted under an item). Chinese is always set in the serif, English always in
   Figtree. Everything else on the page - buttons, headings, messages - is in the selected
   language only, as it is today, and only the Chinese the shop has entered is used.
3. **One release at the end.** Each flow is a PR into the long-lived branch
   `feat/website-redesign`, and that branch merges into `main` once, when every flow is done.
   Merging into `main` deploys to production, so customers never see a half-redesigned site,
   which is the app's rule ("no store build until every flow is done") in this repo's terms.
4. **Admin gets the new colours and fonts, nothing else.** `/admin` shares `globals.css`,
   `tailwind.config.ts`, `src/components/ui` and the root layout's fonts, so it picks up red-bean
   ink text, ink-on-apricot buttons and Figtree. Its layouts, tables and nav are not touched, and
   an admin redesign stays out of scope.

## What changes, and what does not

A visual change. No page fetches, sends or decides anything differently. Checkout is markup
only: its handlers, the payment hold and reprice, the pick-up checks and the order call stay as
they are, as the app's checkout did.

The defaults the mock-ups drew:

- **Header:** logo left; Menu, Contact, Feedback as pills, the current page on apricot; a
  language button naming the other language; a cart button with a count. On a phone: logo, cart,
  and a menu button opening the same links as a sheet. No app-style bottom tab bar - iOS Safari
  keeps its own bar there, and the site has three places to go. The customer header becomes its
  own component; `AdminNavbar` keeps the current `Navbar`, so the admin nav's layout (the logo
  reserve, eight links at 1280px) cannot move.
- **Cart:** the header's cart button plus one ink cart bar at the bottom of the page at every
  width, replacing the floating "View Cart" button and the cart that slides into the menu's
  category bar at 2xl. The cart opens as a bottom sheet on a phone and a side panel on desktop.
- **Customise:** a centred dialog on desktop with "In this bowl" and "Add toppings" side by side,
  a bottom sheet on a phone; rows with steppers, as the app's dessert sheet.
- **Popular choices:** a still row of five, a scrolling strip on a phone, instead of the
  carousel that moves every three seconds.
- **Photos:** every dessert cropped to a circle on rice (`muted`), as the app's menu does: the
  shop's photos are a mix of cut-outs and square shots.
- **Footer:** stays apricot, with ink text (7.65:1) instead of white (2.03:1).
- **The falling desserts** stay, landing on the menu boards as now.
- **Pick-up time:** moves out of its pop-over into the page: ASAP or Pick up later, a strip of
  days, a grid of times with "Later times" for the rest of the day.
- **Stripe's card form** takes the colours, Figtree and the 14px field radius through Stripe's
  Appearance options.
- **Order confirmed:** the 甜 seal, the one achievement moment the website has. The printed
  receipt keeps what it prints today.
- **Contact:** three columns divided by hairlines; the coloured circles go.
- **Sentence case** throughout ("Order online", not "ORDER ONLINE").
- **Fonts:** Figtree for English and Noto Serif SC for Chinese names, both through `next/font`
  (self-hosted at build; the Chinese face comes in slices, so a page downloads only the
  characters it shows). Chinese UI text falls through to the system sans (PingFang SC, Microsoft
  YaHei), since Figtree has no Chinese. Geist and Baloo 2 go.
- **Reduced motion:** nothing here honours it today (the framer-motion entrances on the menu,
  contact and feedback, the falling desserts). The foundation adds the check, as the app has.

**New English in the mock-ups, each needing the owner's Chinese before its flow PR merges:** the
hero heading "Chinese desserts and drinks in Somerville" and its line "Order online and pick up
at the shop, or have it delivered with Uber Eats"; "Open today until 10:00 pm" (and its closed
form), which the page works out from the hours it already loads; "See the full menu"; "The menu
boards in the shop. Select one to see it full size."; "Today" on the opening hours; "Later
times"; "Extra +$1.50 each" for an ingredient already in the bowl. Lines the mock-ups merely
reworded can keep today's wording and Chinese instead.

## Sharing the tokens

**The file is `designTokens.json`:** colours by role, the radii and the two shadows. The colour
keys and values are exactly the app's `colors` in `frontend/lib/theme.ts` (camelCase:
`primaryForeground`, `destructiveSoft`), so the app's screens do not change. Fonts are not in
it: the app bundles font files and this site loads them through Next, so they stay per platform.
The roles, the contrast of every pair and what may sit on what are in the skill's
`references/tokens.md`.

```json
{
  "colors": {
    "background": "#FCF8F3",
    "foreground": "#3B1A1C",
    "card": "#FFFFFF",
    "secondary": "#F9E1B9",
    "secondaryForeground": "#3B1A1C",
    "muted": "#F6EFE7",
    "mutedForeground": "#7A5F5A",
    "primary": "#E6AA6B",
    "primaryForeground": "#3B1A1C",
    "accent": "#9B2F2B",
    "accentForeground": "#FCF8F3",
    "inverse": "#3B1A1C",
    "inverseForeground": "#FCF8F3",
    "brand": "#B97B53",
    "scrim": "rgba(0, 0, 0, 0.5)",
    "border": "#EFDCC4",
    "input": "#9C8279",
    "destructive": "#B42318",
    "destructiveSoft": "#FDE3DF",
    "success": "#2F6B45",
    "successSoft": "#DDEFE2",
    "warning": "#8A4B08",
    "warningSoft": "#FCEBC9"
  },
  "radius": { "seal": 10, "card": 20, "sheet": 28 },
  "shadow": {
    "tabBar": "0 10px 30px rgba(59, 26, 28, 0.16)",
    "cartBar": "0 10px 24px rgba(59, 26, 28, 0.28)"
  }
}
```

JSON rather than TypeScript, like `pickUpTimeCases.json`: no formatter in either repo can
disagree about it (this repo's Prettier adds semicolons to TypeScript and the app's does not,
which is why the legal documents are in `.prettierignore`), and both repos resolve JSON imports.
The copy here goes in `.prettierignore` all the same.

| Repo | Path | Read by |
| --- | --- | --- |
| `eversweet_app` | `frontend/lib/designTokens.json` | `lib/theme.ts` (`export const colors = tokens.colors`), which `tailwind.config.ts` already reads; `fonts` and `chineseSerif` stay in `theme.ts`. `scripts/check-tokens.js` allows hex in the JSON instead of `theme.ts`. |
| this repo | `src/styles/designTokens.json` | `tailwind.config.ts`, which imports it and hands Tailwind the hex values, as the app's config does. |

**How Tailwind here consumes it.** The colour block in `globals.css` goes; `--radius` and the
admin-only `--chart-*` colours stay. `tailwind.config.ts` takes `background`, `foreground`,
`card`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border` and `input` from the
file, maps shadcn's other names onto it (`popover` = card, `card-foreground` and
`popover-foreground` = foreground, `ring` = foreground), and adds `inverse`, `brand`, `success`,
`warning` and the `-soft` grounds, plus `rounded-seal`, `rounded-card` and `rounded-sheet`.
Tailwind parses hex itself, so opacity modifiers (`bg-primary/40`) keep working without the
space-separated HSL that #51 had to enforce; `src/styles/themeTokens.test.ts`, which reads the
colour block in `globals.css`, becomes a test that the config's colours are the file's, and the
"colour tokens stay space-separated" sharp edge goes with the block. CSS variables would be
needed only for a dark set; when one is wanted, both repos move to variables in one paired
change.

Two names clash, and the foundation handles both:

- **`accent`** is a grey hover surface in shadcn and red bean in direction D. `button`,
  `calendar`, `command`, `dialog`, `dropdown-menu` and `select` in `src/components/ui` hover and
  focus with `bg-accent` / `text-accent-foreground`; they move to `bg-muted` (rice), or every
  hovered menu item turns red bean - admin's included.
- **`primary-dark` and `primary-display`**, the caramel this site added for contrast, are not in
  the file. The customer files that use them lose them as each flow is redesigned; the two tokens
  stay, website-only, until nothing uses them.

**Checked in CI on both sides, as the legal documents are.** `npm run verify:tokens` in each repo
compares its copy with the other repo's and exits non-zero when they differ.

- Here: a step in the existing `verify-legal` job, which already checks out `eversweet_app` with
  `EVERSWEET_APP_DEPLOY_KEY`, tries the same-named branch first and retries for about five minutes
  while the other half of a paired push lands.
- `eversweet_app`: a new job in `frontend-ci.yml` (its legal job is in `backend-ci.yml`, filtered
  to `backend/`), checking out this repo, which is public and needs no key. Same branch first,
  same retry loop.
- A token change is a paired change: the same branch name in both repos.
- **This repo's `ci.yml` runs only for pushes and PRs to `main`.** Every flow PR goes into
  `feat/website-redesign`, so PR 0 adds that branch to both triggers; without it the flow PRs
  would get no lint, typecheck, tests, legal check or token check until the release. (The app's
  `frontend-ci.yml` already runs on every branch.)

## The rollout

| # | PR | Into | What |
| --- | --- | --- | --- |
| 0 | Share the design tokens | `main` here, and `main` in `eversweet_app`, paired under one branch name | Here: `src/styles/designTokens.json` (read by nothing yet), `scripts/verify-tokens.mjs`, the `verify:tokens` script, the CI step, `.prettierignore`, and `feat/website-redesign` added to `ci.yml`'s push and pull-request branches. App: `frontend/lib/designTokens.json`, `theme.ts` reading it, the check-tokens change, its verify script and CI job. No pixel changes on either side, so both can merge whenever they are reviewed; landing the file on both `main`s first means neither repo's check ever compares against a branch that lacks it. |
| 1 | Foundation | `feat/website-redesign` | Tailwind and `globals.css` from the tokens; Figtree and Noto Serif SC; the shadcn primitives restyled (button variants, input, label, badge, dialog, a sheet for phones, toast) with the `accent` hovers moved; the customer header, the footer, the cart bar and the cart sheet or panel; a `scripts/check-tokens.mjs` like the app's, listing finished files; reduced motion. Admin is checked at 1280 in both languages. |
| 2 | Browse | `feat/website-redesign` | Home, every section; the menu; the customise dialog and sheet. |
| 3 | Checkout | `feat/website-redesign` | Markup only: the page, the pick-up picker in the page, Stripe Appearance, the empty and "payment successful" states. |
| 4 | Order confirmed | `feat/website-redesign` | The page, its print view and its three not-found states. |
| 5 | The rest | `feat/website-redesign` | Contact, feedback, the legal pages, delete account, not found, the days-off notice, the loader. `/about-us` has no link in the navigation and is left alone unless the owner says. |
| 6 | Release | `main` | `feat/website-redesign` itself. The owner merges it, outside Auckland trading hours, after a full click-through at every width in both languages, a test-mode order included. |

Every flow PR: before-and-after screenshots at 390, 768, 1280 and 1440 wide in English and
Chinese, from a local `next dev` against `eversweet_dev` (never `npm run dev` here: `.env` is
production); `npm run check` and the tests; the diff scan; Greptile. Logic bugs found on the way
go in `OUTSTANDING.md`, not in the design PR; display bugs in markup being rewritten are fixed
there, with a test.

**Keeping the branch current.** Work on `main` carries on meanwhile (admin, fixes). Merge `main`
into `feat/website-redesign` whenever it moves - merge, not rebase, because flow PRs are open
against it - and before each flow PR is opened.

**Previews.** Each flow PR gets a Vercel preview. Before using one to click through a checkout,
check what the Preview environment's variables point at in Vercel: a preview on the production
database and Stripe key would place real orders. Until that is known, checkout is checked
locally.

**Reviews.** All 52 PRs in this repo so far went into `main`, so nothing shows yet whether Greptile
reviews a PR with another base. Before the foundation PR, check in Greptile's settings that it
reviews PRs into `feat/website-redesign`, or each flow PR goes unreviewed until the release.

## Found while planning (not for the design PRs)

- **Shop data:** one Sago dessert is named "taro Purple Rice Bowl", lower-case t. The mock-ups
  show "Taro"; the row is fixed from `/admin/products`.
- **Checkout wording:** it tells customers they agree to "our Terms of Service", but the page is
  "Terms & Conditions", and neither name is a link. PR 3 rewrites that line anyway, so it gets the
  right name and the links there.
- **The opacity-modifier fix** (#51, merged 2026-11-20) is on `main`, and this plan is written
  on top of it. The foundation replaces the colour block it corrected, so its test changes with
  it (above).
