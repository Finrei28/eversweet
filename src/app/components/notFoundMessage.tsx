"use client";

import { SearchX } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { useLanguage } from "~/app/components/language";
import { Button } from "~/components/ui/button";

/**
 * The site's 404, for an address nothing answers and for every `notFound()`, admin's
 * signed-out pages included, which must look like any other missing page.
 *
 * It renders outside the customer layout, so it has no header or footer of its own: the
 * logo leads home, and the message is drawn as the order page's not-found state is.
 */
export default function NotFoundMessage() {
  const { language } = useLanguage();
  const en = language === "en";

  return (
    <div className="flex min-h-dvh flex-col items-center px-5 py-6 md:py-8">
      <Link
        href="/"
        className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Image
          src="/eversweet-logo-header.png"
          alt="Eversweet 永玖甜"
          width={841}
          height={319}
          priority
          className="h-9 w-auto md:h-11"
        />
      </Link>
      <div className="flex max-w-md flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
        <span className="mb-1 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <SearchX
            className="h-10 w-10 text-muted-foreground"
            strokeWidth={1.8}
            aria-hidden
          />
        </span>
        <h1 className="text-2xl font-extrabold">
          {en ? "Page not found" : "找不到页面"}
        </h1>
        <p className="text-[15px] text-muted-foreground">
          {en
            ? "The address may be mistyped, or the page may have moved."
            : "网址可能有误，或页面已移动。"}
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          <Button asChild size="pill-sm">
            <Link href="/">{en ? "Return to home" : "返回首页"}</Link>
          </Button>
          <Button asChild variant="secondary" size="pill-sm">
            <Link href="/menu">{en ? "Back to menu" : "返回菜单"}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
