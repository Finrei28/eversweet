"use client";

import { Loader2 } from "lucide-react";

import { useLanguage } from "~/app/components/language";

type LoaderProps = {
  // Both languages rather than a string: the admin pages that render this are server
  // components and cannot call useLanguage() to choose one themselves.
  text?: { en: string; zh: string };
};

/**
 * What a page shows while it waits for its data: a red-bean spinner, and the text under it
 * when there is any. A screen reader is told it is loading either way.
 *
 * It fills the screen under the customer header (64px and a hairline, 80px from `md`) rather
 * than floating over the page. Fixed over the page, it took no room, so on a phone the footer
 * rose to meet the header and filled half the screen until the data came.
 */
export default function Loader({ text }: LoaderProps) {
  const { language } = useLanguage();
  const en = language === "en";
  const label = text ? (en ? text.en : text.zh) : en ? "Loading…" : "加载中…";

  return (
    <div
      role="status"
      className="flex min-h-[calc(100dvh-65px)] flex-col items-center justify-center gap-4 px-5 md:min-h-[calc(100dvh-81px)]"
    >
      <Loader2 className="h-10 w-10 animate-spin text-accent" aria-hidden />
      {text ? (
        <p className="text-base font-semibold text-muted-foreground">{label}</p>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </div>
  );
}
