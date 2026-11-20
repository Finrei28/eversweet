import { cn } from "~/lib/utils";

/**
 * The classes of an item's two names (`ItemName`): the reader's language leads, in ink,
 * and the other follows, muted. Chinese is always the serif, English always Figtree.
 *
 * Chinese is set at 600 in either place, and that weight comes after the caller's classes so
 * a heading cannot raise it. It is the lighter of the two weights loaded (600 for names, 900
 * for the 甜 seal), and asking for more would get the 900: for any weight above 500, a
 * browser picks the nearest heavier one first. The customise sheet's heading and the menu's
 * category headings pass `font-extrabold`, and their Chinese names were drawn at 900. English
 * keeps whatever weight the caller gives it.
 */
export function itemNameClasses(
  language: "en" | "zh",
  leadClassName: string,
  secondClassName: string,
): { lead: string; second: string } {
  const chineseLeads = language === "zh";
  return {
    lead: chineseLeads
      ? cn("font-zh", "text-foreground", leadClassName, "font-semibold")
      : cn("font-sans", "font-bold", "text-foreground", leadClassName),
    second: chineseLeads
      ? cn("font-sans", "font-medium", "text-muted-foreground", secondClassName)
      : cn(
          "font-zh",
          "text-muted-foreground",
          secondClassName,
          "font-semibold",
        ),
  };
}
