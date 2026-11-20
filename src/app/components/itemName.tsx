"use client";

import { cn } from "~/lib/utils";
import { itemNameClasses } from "./itemNameClasses";
import { useLanguage } from "./language";

/**
 * A dessert's, category's or customisation's name in both languages (REDESIGN.md,
 * decision 2). The reader's language leads, in `leadClassName`'s size and in ink;
 * the other follows smaller, muted. Chinese is always the serif at 600, whatever
 * weight a caller asks for; English always Figtree. See `itemNameClasses`.
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
  const english = { text: name, lang: "en" };
  const chinese = { text: chineseName, lang: "zh-Hans" };
  const [lead, second] =
    language === "en" ? [english, chinese] : [chinese, english];
  const classes = itemNameClasses(language, leadClassName, secondClassName);

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
      <span lang={lead.lang} className={classes.lead}>
        {lead.text}
      </span>
      <span lang={second.lang} className={classes.second}>
        {second.text}
      </span>
    </span>
  );
}
