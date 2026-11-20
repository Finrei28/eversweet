import { describe, expect, it } from "vitest";

import { itemNameClasses } from "./itemNameClasses";

/**
 * Chinese names are set at 600 whatever a caller asks. Only 600 and 900 are loaded, and a
 * browser asked for anything above 500 takes the nearest heavier face, so a heading's
 * `font-extrabold` drew its Chinese name at 900. English keeps the weight it is given.
 */
describe("itemNameClasses", () => {
  it("keeps a Chinese name that leads at 600 under a heavier heading", () => {
    const { lead } = itemNameClasses("zh", "text-[28px] font-extrabold", "");
    expect(lead).toContain("font-semibold");
    expect(lead).not.toContain("font-extrabold");
    expect(lead).toContain("text-[28px]");
    expect(lead).toContain("font-zh");
  });

  it("keeps a Chinese name that follows at 600 too", () => {
    const { second } = itemNameClasses("en", "", "text-lg font-bold");
    expect(second).toContain("font-semibold");
    expect(second).not.toContain("font-bold");
    expect(second).toContain("font-zh");
  });

  it("lets an English name take the caller's weight", () => {
    const { lead } = itemNameClasses("en", "text-[28px] font-extrabold", "");
    expect(lead).toContain("font-extrabold");
    expect(lead).not.toContain("font-bold ");
    expect(lead).toContain("font-sans");
  });

  it("gives each name its default weight and colour when the caller gives none", () => {
    expect(itemNameClasses("en", "text-base", "text-sm")).toEqual({
      lead: "font-sans font-bold text-foreground text-base",
      second: "font-zh text-muted-foreground text-sm font-semibold",
    });
    expect(itemNameClasses("zh", "text-base", "text-sm")).toEqual({
      lead: "font-zh text-foreground text-base font-semibold",
      second: "font-sans font-medium text-muted-foreground text-sm",
    });
  });
});
