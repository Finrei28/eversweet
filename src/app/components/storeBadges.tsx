"use client";

import Image from "next/image";

import { useLanguage } from "~/app/components/language";
import { storeBadges } from "~/lib/appStores";
import { cn } from "~/lib/utils";

/**
 * The App Store and Google Play badges, each linking to the Eversweet listing.
 *
 * Laid out to both stores' rules (`~/lib/appStores` has where the artwork came from):
 * - Apple's first, both at the same height. Google asks for its badge to be no smaller than
 *   any other, and Apple for its own to lead.
 * - Never under Apple's 40px minimum. On a phone they are exactly that, so the pair fits on
 *   one row inside a padded card down to a 360px-wide screen (about 266px for the two); at
 *   48px they need 321px and stacked on a 375px iPhone. From `sm` they are 44px or 48px.
 * - At least a quarter of that height clear between them: 12px at 40px, 16px above.
 *
 * `unoptimized` because the files are already sized for the screen, and Next will not serve
 * an SVG through its optimiser.
 */
export default function StoreBadges({
  size = "lg",
  className,
}: {
  size?: "md" | "lg";
  className?: string;
}) {
  const { language } = useLanguage();

  return (
    <div className={cn("flex flex-wrap items-center gap-3 sm:gap-4", className)}>
      {storeBadges(language).map((badge) => (
        <a
          key={badge.store}
          href={badge.href}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-[0.6rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark focus-visible:ring-offset-2"
        >
          <Image
            src={badge.src}
            alt={badge.alt}
            width={badge.width}
            height={badge.height}
            unoptimized
            className={cn(
              "h-10 w-auto",
              size === "lg" ? "sm:h-12" : "sm:h-11",
            )}
          />
          <span className="sr-only">
            {language === "en"
              ? " (opens in a new tab)"
              : "（在新标签页中打开）"}
          </span>
        </a>
      ))}
    </div>
  );
}
