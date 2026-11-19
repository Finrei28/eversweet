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
