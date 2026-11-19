"use client";

import { cn } from "~/lib/utils";
import { useLanguage } from "./language";

/**
 * A dessert's, category's or customisation's name in both languages (REDESIGN.md,
 * decision 2). The reader's language leads, in `leadClassName`'s size and in ink;
 * the other follows smaller, muted. Chinese is always the serif, English always
 * Figtree, whichever leads.
 *
 * Chinese is set at 600 in either place. It is the lighter of the two weights
 * loaded (600 for names, 900 for the 甜 seal), and asking for bold would get the
 * 900: for any weight above 500, a browser picks the nearest heavier one first.
 */
export function ItemName({
  name,
  chineseName,
  layout = "stacked",
  className,
  leadClassName = "text-base",
  secondClassName = "text-sm",
}: {
  name: string;
  chineseName: string;
  /** `stacked` under an item; `inline` beside a heading. */
  layout?: "stacked" | "inline";
  className?: string;
  leadClassName?: string;
  secondClassName?: string;
}) {
  const { language } = useLanguage();
  const english = { text: name, lang: "en", face: "font-sans" };
  const chinese = { text: chineseName, lang: "zh-Hans", face: "font-zh" };
  const [lead, second] =
    language === "en" ? [english, chinese] : [chinese, english];

  return (
    <span
      className={cn(
        "flex min-w-0",
        layout === "inline"
          ? "flex-row flex-wrap items-baseline gap-x-2"
          : "flex-col gap-0.5",
        className,
      )}
    >
      <span
        lang={lead.lang}
        className={cn(
          lead.face,
          lead === chinese ? "font-semibold" : "font-bold",
          "text-foreground",
          leadClassName,
        )}
      >
        {lead.text}
      </span>
      <span
        lang={second.lang}
        className={cn(
          second.face,
          second === chinese ? "font-semibold" : "font-medium",
          "text-muted-foreground",
          secondClassName,
        )}
      >
        {second.text}
      </span>
    </span>
  );
}
