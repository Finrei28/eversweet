#!/usr/bin/env node
/**
 * Checks that the shared design tokens in this repo still match the customer app's copy.
 *
 * `src/styles/designTokens.json` and the app's `frontend/lib/designTokens.json` are the same
 * file, holding direction D's colours, radii and shadows for both. Nothing here reads it until
 * the redesign's foundation wires it into tailwind.config.ts (REDESIGN.md). Nothing about
 * that is enforceable from CI - two repositories, two runners, no shared checkout - so this
 * is the gate, and it has to be run.
 *
 * It is modelled on `verify:legal` (scripts/verify-legal.mjs), which does the same for the
 * Terms and the Privacy Policy.
 *
 * Point it at the sibling checkout with EVERSWEET_APP_REPO if it is not in the usual place.
 * With no sibling to compare against it skips rather than fails, so a machine that only has
 * one of the two repos can still run it.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

const MINE = join(repoRoot, "src", "styles", "designTokens.json");

// An explicit override is the only candidate when it is set. Falling through to the
// guesses below would let a CI job that pointed at the wrong path quietly compare against
// something else, or - worse - find nothing and be told to skip.
const CANDIDATES = process.env.EVERSWEET_APP_REPO
  ? [process.env.EVERSWEET_APP_REPO]
  : [
      "C:/Users/User/OneDrive/Desktop/eversweet_APP/eversweet_app",
      resolve(repoRoot, "..", "eversweet_app"),
    ];

// Compared as git stores them. Both repos are checked out with core.autocrlf on Windows, so
// one checkout can hold the file with CRLF and the other with LF, though the committed bytes
// are the same. Every other byte has to match.
const read = (path) => {
  try {
    const text = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
    return Buffer.from(text, "utf8");
  } catch {
    return null;
  }
};

const digest = (buffer) =>
  createHash("sha256").update(buffer).digest("hex").slice(0, 12);

const mine = read(MINE);
if (!mine) {
  console.error(`verify:tokens - cannot read ${MINE}`);
  process.exit(1);
}

let theirPath = null;
let theirs = null;
for (const candidate of CANDIDATES) {
  const path = join(candidate, "frontend", "lib", "designTokens.json");
  const contents = read(path);
  if (contents) {
    theirPath = path;
    theirs = contents;
    break;
  }
}

if (!theirs) {
  // Skipping is right on a developer machine that has only one of the two repos
  // checked out. In CI it is not: a job that cannot find the other copy has proved
  // nothing, and passing would make this check decorative.
  if (process.env.CI) {
    console.error(
      "verify:tokens - running in CI with no copy of the app's design tokens to compare " +
        "against. The workflow must check out the other repository.",
    );
    process.exit(1);
  }

  console.log(
    "verify:tokens - no checkout of the app with frontend/lib/designTokens.json is on this " +
      "machine, so there is nothing to compare against. Set EVERSWEET_APP_REPO to check.",
  );
  process.exit(0);
}

if (mine.equals(theirs)) {
  console.log(`verify:tokens - both copies match (sha256 ${digest(mine)}).`);
  process.exit(0);
}

console.error(
  [
    "",
    "verify:tokens - THE DESIGN TOKENS HAVE DRIFTED.",
    "",
    `  this repo      ${MINE}`,
    `                 sha256 ${digest(mine)}`,
    `  customer app   ${theirPath}`,
    `                 sha256 ${digest(theirs)}`,
    "",
    "  These two files are meant to be identical - the website and the app take their",
    "  design tokens from them. A token change is a paired change, made in both repos",
    "  under one branch name. Copy whichever is correct over the other, then run this",
    "  again:",
    "",
    `    cp "${theirPath}" "${MINE}"`,
    "",
    "  If Prettier did this, check that src/styles/designTokens.json is still listed",
    "  in .prettierignore.",
    "",
  ].join("\n"),
);
process.exit(1);
