"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import { Globe, Menu, ShoppingBag } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetCloseButton,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { useHydrated } from "~/lib/browserState";
import { cn } from "~/lib/utils";
import { viewCartLabel } from "./cartBar";
import { CartContext } from "./cartContext";
import { useLanguage } from "./language";

const LINKS = [
  { href: "/menu", en: "Menu", zh: "菜单" },
  { href: "/contact", en: "Contact", zh: "联系方法" },
  { href: "/feedback", en: "Feedback", zh: "反馈" },
] as const;

/**
 * The customer pages' header. Admin keeps the old `Navbar`, whose layout is fitted
 * to eight links at 1280px (CLAUDE.md, Admin UI conventions), so it cannot move.
 *
 * From `md` up: the logo, the three links as pills with the current page on
 * apricot, a button naming the other language, and the cart once it has
 * something in it. On a phone: the logo, the cart, and a button opening the same
 * links as a sheet. It scrolls away with the page; the cart bar stays.
 */
export function SiteHeader() {
  const pathName = usePathname();
  const { language, toggleLanguage } = useLanguage();
  const cart = useContext(CartContext);
  const hydrated = useHydrated();
  const [menuOpen, setMenuOpen] = useState(false);
  const en = language === "en";

  useEffect(() => setMenuOpen(false), [pathName]);

  const count = hydrated ? (cart?.totalItems ?? 0) : 0;
  const showCart = count > 0 && pathName !== "/checkout";

  const languageButton = (className?: string) => (
    <Button
      variant="secondary"
      size="chip"
      onClick={toggleLanguage}
      className={cn("gap-2 px-4 font-bold", className)}
    >
      <Globe className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
      {/* Named in the language it switches to, so either reader can find it. */}
      <span lang={en ? "zh-Hans" : "en"}>{en ? "中文" : "English"}</span>
    </Button>
  );

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center gap-2.5 px-5 md:h-20 md:gap-2">
        <Link
          href="/"
          className="mr-auto flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

        <nav
          aria-label={en ? "Main" : "主导航"}
          className="hidden gap-1 md:flex"
        >
          {LINKS.map((link) => (
            <HeaderLink
              key={link.href}
              href={link.href}
              current={pathName === link.href}
            >
              {en ? link.en : link.zh}
            </HeaderLink>
          ))}
        </nav>
        {languageButton("ml-3 hidden md:inline-flex")}

        {showCart && cart && (
          <Button
            variant="secondary"
            size="round"
            aria-label={viewCartLabel(language, count)}
            onClick={() => cart.setIsCartOpen(true)}
            className="relative"
          >
            <ShoppingBag strokeWidth={1.8} aria-hidden />
            <span
              aria-hidden
              className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-inverse px-[5px] text-xs font-extrabold tabular-nums text-inverse-foreground"
            >
              {count}
            </span>
          </Button>
        )}

        <Button
          variant="secondary"
          size="round"
          aria-label={en ? "Open menu" : "打开导航"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
          className="md:hidden"
        >
          <Menu strokeWidth={2} aria-hidden />
        </Button>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="bottom" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle className="sr-only">Eversweet</SheetTitle>
            <Image
              src="/eversweet-logo-header.png"
              alt=""
              width={841}
              height={319}
              className="h-9 w-auto"
            />
            <SheetCloseButton label={en ? "Close" : "关闭"} />
          </SheetHeader>
          <nav
            aria-label={en ? "Main" : "主导航"}
            className="flex flex-col gap-1 px-5 pb-4 pt-3"
          >
            {LINKS.map((link) => (
              <HeaderLink
                key={link.href}
                href={link.href}
                current={pathName === link.href}
                // Closed on the tap itself, not only when the path changes: the
                // current page's own link changes nothing, and left the sheet up.
                onClick={() => setMenuOpen(false)}
                className="h-14 justify-start px-5 text-lg"
              >
                {en ? link.en : link.zh}
              </HeaderLink>
            ))}
          </nav>
          <div className="border-t border-border px-5 pb-8 pt-4">
            {languageButton("w-full")}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}

function HeaderLink({
  href,
  current,
  onClick,
  className,
  children,
}: {
  href: string;
  current: boolean;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex h-11 items-center rounded-full px-[18px] text-base text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        current
          ? "bg-primary font-extrabold text-primary-foreground"
          : "font-semibold hover:bg-muted",
        className,
      )}
    >
      {children}
    </Link>
  );
}
