import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `accent` is red bean in direction D: Chinese names, links, the 甜 seal. In shadcn it
 * was a grey hover surface, and these primitives still hovered, focused and selected on
 * it, so every hovered menu item, focused option and selected calendar day would have
 * turned red bean - admin's included. They use rice (`muted`) instead.
 */
describe("the shadcn primitives", () => {
  const dir = join(process.cwd(), "src", "components", "ui");
  const files = readdirSync(dir).filter((f) => f.endsWith(".tsx"));

  it.each(files)("%s never paints a surface in accent", (file) => {
    const source = readFileSync(join(dir, file), "utf8");
    const surfaces = source.match(
      /[\w:[\]&().=-]*(?:bg-accent|text-accent-foreground)\S*/g,
    );

    expect(surfaces ?? []).toEqual([]);
  });
});
