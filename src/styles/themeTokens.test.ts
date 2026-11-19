import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Every colour token has to be space-separated HSL ("28 66% 70%"), never comma-separated.
 *
 * `tailwind.config.ts` maps each one as `hsl(var(--token))`, and an opacity modifier
 * (`bg-primary/10`) turns that into `hsl(var(--token) / 0.1)`. Only the space-separated form
 * can take the alpha. `--primary` and `--secondary` were written with commas, so every
 * modifier on them was invalid and the browser dropped it: no fill, no tint, and borders in
 * the text colour, near-black. The order details card had a black border, the condensed
 * navbar and the menu's category bar a black line, and the menu's hero gradient and its
 * category dividers did not draw at all.
 */
describe("theme colour tokens", () => {
  const css = readFileSync(
    join(process.cwd(), "src", "styles", "globals.css"),
    "utf8",
  );
  // Every custom property whose value starts with a number: the HSL colour triples
  // (`--radius: 0.5rem` has no comma either way, so it passes harmlessly).
  const tokens = [...css.matchAll(/(--[\w-]+):\s*([\d.][^;]*);/g)].map(
    ([, name, value]) => ({ name, value: value!.trim() }),
  );

  it("finds the tokens", () => {
    expect(tokens.map((t) => t.name)).toEqual(
      expect.arrayContaining(["--primary", "--secondary", "--background"]),
    );
  });

  it("writes every colour token space-separated, so opacity modifiers work", () => {
    const withCommas = tokens.filter((t) => t.value.includes(","));

    expect(withCommas).toEqual([]);
  });
});
