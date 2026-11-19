import { readFileSync } from "node:fs";
import { join } from "node:path";

import { MotionConfig } from "framer-motion";
import { describe, expect, it } from "vitest";

import { MotionPreferences } from "./motionPreferences";

/**
 * Nothing on the site honoured "reduce motion" but the falling desserts, which draw
 * themselves already landed. The menu's, contact's and feedback's entrances slid in
 * regardless, as did every dialog and the cart.
 */
describe("reduced motion", () => {
  it("has framer-motion follow the reader's setting", () => {
    const element = MotionPreferences({ children: "page" });

    expect(element.type).toBe(MotionConfig);
    // "user" drops transform and layout animation and keeps the fade.
    expect(element.props.reducedMotion).toBe("user");
  });

  it("stops CSS animation and transitions when the reader asks", () => {
    const css = readFileSync(
      join(process.cwd(), "src", "styles", "globals.css"),
      "utf8",
    );
    const block =
      /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(
        css,
      )?.[1];

    expect(block).toBeDefined();
    expect(block).toContain("animation-duration: 0.01ms !important");
    expect(block).toContain("transition-duration: 0.01ms !important");
    expect(block).toContain("scroll-behavior: auto !important");
  });
});
