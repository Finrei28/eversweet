"use client";

import { usePathname } from "next/navigation";
import { useContext } from "react";
import { ShoppingBag } from "lucide-react";

import { useHydrated } from "~/lib/browserState";
import { formatCurrency } from "~/lib/formatters";
import { CartContext } from "./cartContext";
import { useLanguage } from "./language";

/**
 * Whether the cart bar is on screen: something in the cart, and not on checkout,
 * which is where the bar would take the customer. The footer and the scroll-to-top
 * button make room for it on the same answer.
 */
export function useCartBarShown(): boolean {
  const cart = useContext(CartContext);
  const pathName = usePathname();
  const hydrated = useHydrated();
  return hydrated && (cart?.totalItems ?? 0) > 0 && pathName !== "/checkout";
}

/** "View cart, 3 items" in the reader's language, for the bar and the header. */
export function viewCartLabel(language: "en" | "zh", count: number): string {
  return language === "en"
    ? `View cart, ${count} ${count === 1 ? "item" : "items"}`
    : `查看购物车，${count} 件商品`;
}

/**
 * The ink bar along the bottom of every customer page while the cart has anything
 * in it, at every width: the cart's total, and the way into it. It replaced the
 * floating "View Cart" button and the cart button the menu's category bar grew at
 * 2xl. The header's cart button opens the same sheet.
 */
export function CartBar() {
  const cart = useContext(CartContext);
  const { language } = useLanguage();
  const shown = useCartBarShown();

  if (!cart || !shown) return null;
  const label = viewCartLabel(language, cart.totalItems);

  return (
    <button
      type="button"
      onClick={() => cart.setIsCartOpen(true)}
      className="fixed inset-x-4 bottom-6 z-40 flex h-14 items-center justify-between gap-4 rounded-full bg-inverse px-[22px] text-inverse-foreground shadow-cart-bar transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background md:inset-x-auto md:left-1/2 md:h-[60px] md:w-[560px] md:-translate-x-1/2 md:px-[26px]"
    >
      <span className="flex min-w-0 items-center gap-3 text-base font-bold md:text-[17px]">
        <ShoppingBag
          className="hidden h-[22px] w-[22px] shrink-0 text-secondary md:block"
          strokeWidth={1.8}
          aria-hidden
        />
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 text-base font-extrabold tabular-nums text-primary md:text-[17px]">
        {formatCurrency(cart.totalPrice / 100)}
      </span>
    </button>
  );
}
