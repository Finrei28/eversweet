import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import config from "../../tailwind.config";
import tokens from "./designTokens.json";

/**
 * Tailwind takes direction D's colours, radii and the cart bar's shadow from
 * `designTokens.json`, the file the customer app holds byte-for-byte as well
 * (`npm run verify:tokens`). They used to be HSL triples in `globals.css`, typed
 * a second time beside the app's, and nothing noticed when the two disagreed.
 */
const colors: unknown = config.theme.extend.colors;

const at = (path: string) =>
  path
    .split(".")
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[key]
          : undefined,
      colors,
    );

// Where each token is wired into the theme. Keyed by the token file's own names,
// so a colour added to the file without a place here fails the typecheck.
const WIRING: Record<keyof typeof tokens.colors, string> = {
  background: "background",
  foreground: "foreground",
  card: "card.DEFAULT",
  secondary: "secondary.DEFAULT",
  secondaryForeground: "secondary.foreground",
  muted: "muted.DEFAULT",
  mutedForeground: "muted.foreground",
  primary: "primary.DEFAULT",
  primaryForeground: "primary.foreground",
  accent: "accent.DEFAULT",
  accentForeground: "accent.foreground",
  inverse: "inverse.DEFAULT",
  inverseForeground: "inverse.foreground",
  brand: "brand",
  scrim: "scrim",
  border: "border",
  input: "input",
  destructive: "destructive.DEFAULT",
  destructiveSoft: "destructive.soft",
  success: "success.DEFAULT",
  successSoft: "success.soft",
  warning: "warning.DEFAULT",
  warningSoft: "warning.soft",
};

describe("the Tailwind theme", () => {
  it.each(Object.entries(WIRING))(
    "takes %s from the token file",
    (token, path) => {
      expect(at(path)).toBe(tokens.colors[token as keyof typeof tokens.colors]);
    },
  );

  it("maps shadcn's other names onto the tokens", () => {
    expect({
      popover: at("popover.DEFAULT"),
      popoverForeground: at("popover.foreground"),
      cardForeground: at("card.foreground"),
      destructiveForeground: at("destructive.foreground"),
      ring: at("ring"),
    }).toEqual({
      popover: tokens.colors.card,
      popoverForeground: tokens.colors.foreground,
      cardForeground: tokens.colors.foreground,
      // White on the error red, 6.57:1 (the skill's tokens.md).
      destructiveForeground: tokens.colors.card,
      ring: tokens.colors.foreground,
    });
  });

  it("takes the radii and the cart bar's shadow from the token file", () => {
    const { borderRadius, boxShadow } = config.theme.extend as {
      borderRadius?: Record<string, string>;
      boxShadow?: Record<string, string>;
    };

    expect({
      seal: borderRadius?.seal,
      card: borderRadius?.card,
      sheet: borderRadius?.sheet,
      cartBar: boxShadow?.["cart-bar"],
    }).toEqual({
      seal: `${tokens.radius.seal}px`,
      card: `${tokens.radius.card}px`,
      sheet: `${tokens.radius.sheet}px`,
      cartBar: tokens.shadow.cartBar,
    });
  });
});

describe("globals.css", () => {
  const css = readFileSync(
    join(process.cwd(), "src", "styles", "globals.css"),
    "utf8",
  );
  const defined = [...css.matchAll(/(--[\w-]+):\s*([^;]*);/g)].map(
    ([, name, value]) => ({ name: name!, value: value!.trim() }),
  );

  it("defines no colour the token file owns", () => {
    // `secondaryForeground` would be `--secondary-foreground` there.
    const owned = Object.keys(tokens.colors).map(
      (key) => `--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`,
    );

    expect(defined.map((d) => d.name).filter((n) => owned.includes(n))).toEqual(
      [],
    );
  });

  /**
   * What is left there is HSL, mapped as `hsl(var(--token))`, and an opacity
   * modifier (`bg-primary-dark/10`) builds `hsl(var(--token) / 0.1)`, which only
   * the space-separated form can take. `--primary` and `--secondary` were written
   * with commas until 2026-11-20, and the browser dropped every modifier on them.
   */
  it("writes the HSL colours it still holds space-separated", () => {
    const hsl = defined.filter((d) => /^[\d.]/.test(d.value));

    expect(hsl.map((d) => d.name)).toEqual(
      expect.arrayContaining(["--primary-dark", "--primary-display"]),
    );
    expect(hsl.filter((d) => d.value.includes(","))).toEqual([]);
  });
});
