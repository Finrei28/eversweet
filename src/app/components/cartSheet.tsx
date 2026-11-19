"use client";

import Image from "next/image";
import Link from "next/link";
import { useContext } from "react";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetCloseButton,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { DESKTOP_MIN_WIDTH, useMinWidth } from "~/lib/browserState";
import { formatCurrency } from "~/lib/formatters";
import { cn } from "~/lib/utils";
import { CartContext, type CartItem } from "./cartContext";
import { ItemName } from "./itemName";
import { useLanguage } from "./language";

/**
 * The cart: a bottom sheet on a phone, a panel from the right on desktop. It took
 * over from the modal that lived in the old navbar, and is opened from the
 * header's cart button and the cart bar.
 *
 * Display only. Every number is worked out as the old modal did and every button
 * calls the same cart function, so nothing about what the cart holds or costs has
 * changed; the checkout reprices from the database anyway.
 */
export function CartSheet() {
  const cart = useContext(CartContext);
  const { language } = useLanguage();
  const isDesktop = useMinWidth(DESKTOP_MIN_WIDTH);
  const en = language === "en";

  if (!cart) return null;
  const { isCartOpen, setIsCartOpen } = cart;
  const close = () => setIsCartOpen(false);
  const hasItems = cart.cart.length > 0;

  return (
    <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        aria-describedby={undefined}
        className={cn(!isDesktop && "h-[78dvh]")}
      >
        <SheetHeader className={cn(isDesktop && "pt-5")}>
          <SheetTitle>{en ? "Your cart" : "您的购物车"}</SheetTitle>
          <SheetCloseButton label={en ? "Close" : "关闭"} />
        </SheetHeader>

        {hasItems ? (
          <>
            <ul className="min-h-0 flex-1 overflow-y-auto px-5">
              {cart.cart.map((item) => (
                <CartLine
                  key={`${item.id}-${item.promoNumber ?? "no-promo"}-${item.discountedAmountInCents}`}
                  item={item}
                />
              ))}
            </ul>

            <div className="flex shrink-0 flex-col gap-2.5 border-t border-border bg-card px-5 pb-7 pt-3.5">
              <div className="flex items-baseline justify-between">
                <span className="text-base font-bold">
                  {en ? "Total" : "总计"}
                </span>
                <span className="text-xl font-extrabold tabular-nums">
                  {formatCurrency(cart.totalPrice / 100)}
                </span>
              </div>
              <Button asChild size="cta" className="w-full">
                <Link href="/checkout" onClick={close}>
                  {en ? "Checkout" : "买单"}
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="pill-sm"
                className="w-full"
                onClick={close}
              >
                {en ? "Continue adding" : "继续购物"}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 pb-10 text-center">
            <span className="mb-1 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <ShoppingBag
                className="h-9 w-9 text-muted-foreground"
                aria-hidden
              />
            </span>
            <h3 className="text-xl font-extrabold">
              {en ? "Your cart is empty" : "您的购物车是空的"}
            </h3>
            <p className="text-[15px] text-muted-foreground">
              {en
                ? "Looks like you haven't added any items to your cart yet."
                : "看起来您还没有将任何商品添加到购物车中。"}
            </p>
            <Button size="pill-sm" className="mt-3" onClick={close}>
              {en ? "Start adding" : "开始购物"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CartLine({ item }: { item: CartItem }) {
  const cart = useContext(CartContext);
  const { language } = useLanguage();
  const en = language === "en";
  if (!cart) return null;

  // One of this line, as the old modal showed it: the dessert after any discount,
  // plus what its customisations add.
  const extrasInCents = item.customisations.reduce(
    (sum, c) => sum + c.priceInCents * c.quantity,
    0,
  );
  const eachInCents =
    item.priceInCents - item.discountedAmountInCents + extrasInCents;
  const discounted = item.discountedAmountInCents > 0;
  const shownName = en ? item.dessert.name : item.dessert.chineseName;

  return (
    <li className="flex gap-3 border-b border-border py-3.5 last:border-b-0">
      <span className="h-[60px] w-[60px] shrink-0 overflow-hidden rounded-full bg-muted">
        <Image
          src={item.dessert.imagePath}
          alt=""
          width={60}
          height={60}
          className="h-full w-full object-cover"
        />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-start justify-between gap-2">
          <ItemName
            name={item.dessert.name}
            chineseName={item.dessert.chineseName}
          />
          <span className="flex shrink-0 items-baseline gap-1.5 tabular-nums">
            {discounted && (
              <span className="text-[13px] text-muted-foreground line-through">
                {formatCurrency((item.priceInCents + extrasInCents) / 100)}
              </span>
            )}
            <span className="text-base font-bold">
              {formatCurrency(eachInCents / 100)}
            </span>
          </span>
        </div>

        {item.customisations.map((c) => (
          <p
            key={`${c.id}-${item.promoNumber ?? "no-promo"}-${item.discountedAmountInCents}`}
            className="flex flex-wrap items-baseline gap-x-1.5 text-[13px] text-muted-foreground"
          >
            {/* As the old modal wrote it: "- Taro" for one taken out. */}
            <span>{c.quantity < 1 ? "−" : "+"}</span>
            {c.quantity > 1 && (
              <span className="tabular-nums">{c.quantity}</span>
            )}
            <span lang={en ? "en" : "zh-Hans"} className={cn(!en && "font-zh")}>
              {en ? c.name : c.chineseName}
            </span>
            <span
              lang={en ? "zh-Hans" : "en"}
              className={cn("text-xs", en && "font-zh")}
            >
              {en ? c.chineseName : c.name}
            </span>
          </p>
        ))}

        {discounted && (
          <span className="text-xs font-bold text-accent">
            {en ? "Special offer" : "特价"}
          </span>
        )}

        <div className="mt-0.5 flex items-center justify-between">
          <div className="-ml-[7px] flex items-center">
            <button
              type="button"
              aria-label={en ? `One fewer ${shownName}` : `少一份${shownName}`}
              onClick={() => cart.removeFromCart(item.id)}
              className="group flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full border-[1.5px] border-accent text-accent transition-colors group-hover:bg-muted">
                <Minus className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden />
              </span>
            </button>
            <span className="w-4 text-center font-bold tabular-nums">
              {item.quantity}
            </span>
            <button
              type="button"
              aria-label={en ? `One more ${shownName}` : `多一份${shownName}`}
              onClick={() => cart.addExtraToCart(item.id)}
              disabled={!!item.promoNumber}
              className="group flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
            >
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-primary text-primary-foreground transition-[filter] group-hover:brightness-95">
                <Plus className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden />
              </span>
            </button>
          </div>
          <button
            type="button"
            aria-label={en ? `Remove ${shownName}` : `移除${shownName}`}
            onClick={() => cart.removeAllSameItemFromCart(item.id)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}
