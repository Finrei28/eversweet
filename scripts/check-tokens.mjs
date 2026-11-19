#!/usr/bin/env node
/**
 * Holds the redesigned files to direction D's first rule: colours from the tokens, never
 * typed. Modelled on the customer app's `scripts/check-tokens.js`.
 *
 * Every colour lives in `src/styles/designTokens.json`, shared with the app, and reaches
 * the pages through `tailwind.config.ts`. A page restyled once drifts back the first time
 * a fix lands in it, so every file the redesign has finished goes on the list below, and
 * CI fails if one of them picks up:
 *
 *   - a hex colour (`#e6aa6b`), or an `rgb()` / `hsl()` one in a class (`shadow-[...]`);
 *   - a stock Tailwind palette class (`text-gray-500`, `bg-white`, `border-red-300`);
 *   - `primary-dark` or `primary-display`, the caramels this site added before direction
 *     D, which are not in the token file and go once nothing uses them (REDESIGN.md).
 *
 * The app's third rule, against weight classes, is not here: it guards an Android font
 * quirk, and a browser picks a weight from the loaded faces as it should.
 *
 * A file joins the list when its flow is redesigned. Nothing leaves it.
 *
 *   node scripts/check-tokens.mjs          # or: npm run check:tokens
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REDESIGNED = [
  // The foundation (REDESIGN.md, PR 1).
  "src/components/ui/badge.tsx",
  "src/components/ui/button.tsx",
  "src/components/ui/dialog.tsx",
  "src/components/ui/form.tsx",
  "src/components/ui/input.tsx",
  "src/components/ui/label.tsx",
  "src/components/ui/sheet.tsx",
  "src/components/ui/textarea.tsx",
  "src/components/ui/toast.tsx",
  "src/app/(customerFacing)/layout.tsx",
  "src/app/(customerFacing)/menu/_components/toTop.tsx",
  "src/app/components/cartBar.tsx",
  "src/app/components/cartSheet.tsx",
  "src/app/components/itemName.tsx",
  "src/app/components/siteFooter.tsx",
  "src/app/components/siteHeader.tsx",
  // Browse (PR 2): home, the menu, the customise dialog.
  "src/components/ui/stepper.tsx",
  "src/app/_components/homePageContent.tsx",
  "src/app/_components/_homeComponents/get-the-app.tsx",
  "src/app/_components/_homeComponents/hero.tsx",
  "src/app/_components/_homeComponents/menu-photos.tsx",
  "src/app/_components/_homeComponents/opening-hours.tsx",
  "src/app/_components/_homeComponents/top-desserts.tsx",
  "src/app/_components/_homeComponents/uber-eats.tsx",
  "src/app/(customerFacing)/menu/_components/customisation.tsx",
  "src/app/(customerFacing)/menu/_components/menu-cards.tsx",
  "src/app/components/dessertPrice.tsx",
  "src/app/components/storeBadges.tsx",
  // Checkout (PR 3): the page, its sections, and Stripe's card fields.
  "src/app/(customerFacing)/checkout/page.tsx",
  "src/app/(customerFacing)/checkout/_components/checkoutForm.tsx",
  "src/app/(customerFacing)/checkout/_components/customerInformation.tsx",
  "src/app/(customerFacing)/checkout/_components/orderSummary.tsx",
  "src/app/(customerFacing)/checkout/_components/paymentSection.tsx",
  "src/app/(customerFacing)/checkout/_components/pick-up-time.tsx",
  "src/lib/stripeAppearance.ts",
  // Order confirmed (PR 4): the page, its not-found states and the app card under it.
  "src/app/(customerFacing)/order/page.tsx",
  "src/app/(customerFacing)/order/_components/earnInTheApp.tsx",
  // The rest (PR 5): contact, feedback, the documents, not found, the days-off notice and
  // the loader.
  "src/components/ui/checkbox.tsx",
  "src/app/(customerFacing)/contact/_components/contact.tsx",
  "src/app/(customerFacing)/feedback/_components/feedback.tsx",
  "src/app/(customerFacing)/delete-account/page.tsx",
  "src/app/components/documentPage.tsx",
  "src/app/components/legalDocument.tsx",
  "src/app/not-found.tsx",
  "src/app/components/notFoundMessage.tsx",
  "src/app/components/daysOffNotice.tsx",
  "src/app/components/customLoading.tsx",
];

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black";

const RULES = [
  { name: "hex colour", pattern: /#[0-9a-fA-F]{3,8}\b/ },
  { name: "raw colour", pattern: /\b(?:rgba?|hsla?)\(/ },
  {
    name: "palette class",
    pattern: new RegExp(
      `\\b(?:bg|text|border|border-[trblxy]|ring|ring-offset|outline|fill|stroke|from|to|via|divide|placeholder|decoration|shadow|caret|accent)-(?:${PALETTE})(?:-\\d{2,3})?(?:/\\d+)?\\b`,
    ),
  },
  { name: "pre-redesign caramel", pattern: /\bprimary-(?:dark|display)\b/ },
];

const problems = [];

for (const file of REDESIGNED) {
  const full = join(root, file);
  if (!existsSync(full)) {
    problems.push(
      `${file}: listed but missing - moved or renamed? Update the list.`,
    );
    continue;
  }
  readFileSync(full, "utf8")
    .split(/\r?\n/)
    .forEach((line, index) => {
      // Comments may name what is not allowed ("white on apricot is 2.03:1").
      const code = line
        .replace(/\/\/.*$/, "")
        .replace(/^\s*\*.*$/, "")
        .replace(/\{\/\*.*?\*\/\}/g, "");
      for (const rule of RULES) {
        const match = code.match(rule.pattern);
        if (match)
          problems.push(`${file}:${index + 1}: ${rule.name} "${match[0]}"`);
      }
    });
}

if (problems.length) {
  console.error(
    "Redesigned files must take their colours from the tokens (src/styles/designTokens.json, through tailwind.config.ts):\n",
  );
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    "\nUse a token class (text-muted-foreground, bg-secondary, bg-destructive-soft). A missing",
  );
  console.error(
    "token is added to designTokens.json in both repos, under one branch name, not inlined.",
  );
  process.exit(1);
}

console.log(
  `check-tokens: ${REDESIGNED.length} redesigned files use tokens only.`,
);
