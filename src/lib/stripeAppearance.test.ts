import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import tokens from "~/styles/designTokens.json";
import { stripeAppearance } from "./stripeAppearance";

/**
 * Stripe draws the card fields in its own frame, out of reach of the site's CSS, so the
 * checkout dresses them through Stripe's Appearance API. These hold that dress to the
 * same tokens and field shape as every other field the redesign draws.
 */
const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

/** Every hex colour anywhere in the appearance, variables and rules alike. */
const coloursIn = (value: unknown): string[] =>
  JSON.stringify(value).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];

describe("stripeAppearance", () => {
  it("takes every colour from the design tokens", () => {
    const palette = new Set(
      Object.values(tokens.colors).map((c) => c.toLowerCase()),
    );
    const used = coloursIn(stripeAppearance);
    expect(used.length).toBeGreaterThan(0);
    for (const colour of used) expect(palette).toContain(colour.toLowerCase());
  });

  it("writes in ink on white, as the site's fields do", () => {
    expect(stripeAppearance.variables).toMatchObject({
      colorText: tokens.colors.foreground,
      colorBackground: tokens.colors.card,
      colorDanger: tokens.colors.destructive,
    });
  });

  it("edges a field in the input colour, and in ink once focused", () => {
    expect(stripeAppearance.rules?.[".Input"]?.border).toBe(
      `1px solid ${tokens.colors.input}`,
    );
    expect(stripeAppearance.rules?.[".Input:focus"]).toMatchObject({
      borderColor: tokens.colors.foreground,
    });
  });

  it('rounds a field as `Input variant="field"` does', () => {
    // `rounded-[14px]` in the site's own field.
    expect(read("src/components/ui/input.tsx")).toContain("rounded-[14px]");
    expect(stripeAppearance.variables?.borderRadius).toBe("14px");
  });

  it('labels a field as `Label variant="field"` does', () => {
    expect(read("src/components/ui/label.tsx")).toContain(
      "text-[15px] font-bold",
    );
    expect(stripeAppearance.rules?.[".Label"]).toMatchObject({
      fontSize: "15px",
      fontWeight: "700",
    });
  });

  it("names the site's faces, falling back to the system's", () => {
    expect(stripeAppearance.variables?.fontFamily).toMatch(
      /^Figtree, .*Microsoft YaHei.*, system-ui, sans-serif$/,
    );
  });

  it("loads nothing into Stripe's frame from anywhere else", () => {
    // A web font fetched there (Google Fonts, say) would hand the customer's address to
    // a third party the privacy policy does not name.
    expect(JSON.stringify(stripeAppearance)).not.toMatch(/https?:|url\(/);
  });
});
