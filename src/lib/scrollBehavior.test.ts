import { afterEach, describe, expect, it, vi } from "vitest";

import { scrollBehavior } from "./scrollBehavior";

/**
 * `scroll-behavior: auto !important` in globals.css stops CSS smooth scrolling under
 * "reduce motion", but a script that asks for `behavior: "smooth"` overrides it. The
 * back-to-top button, the menu's category bar and the home page's jump to the opening
 * hours all did, so they glided across the page regardless.
 */
const prefers = (reduce: boolean) =>
  vi.stubGlobal("window", {
    matchMedia: (query: string) => ({
      matches: reduce && query === "(prefers-reduced-motion: reduce)",
    }),
  });

describe("scrollBehavior", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("jumps when the reader asks for reduced motion", () => {
    prefers(true);
    expect(scrollBehavior()).toBe("auto");
  });

  it("glides otherwise", () => {
    prefers(false);
    expect(scrollBehavior()).toBe("smooth");
  });
});
