"use client";

import { formatCurrency } from "~/lib/formatters";
import { promoDiscountInCents } from "~/lib/dessertPricing";
import type { dessertOnClient } from "~/lib/types";
import { cn } from "~/lib/utils";

type Priced = Pick<
  dessertOnClient,
  "name" | "chineseName" | "priceInCents" | "promo"
>;

/**
 * A dessert's price as the menu and the popular choices show it: the price, and under a
 * promotion the price it was, struck, and "Special offer" in red bean. Prices are tabular.
 */
export function DessertPrice({
  dessert,
  language,
  className,
  priceClassName = "text-[17px]",
}: {
  dessert: Priced;
  language: "en" | "zh";
  className?: string;
  priceClassName?: string;
}) {
  const discount = promoDiscountInCents(dessert);
  return (
    <span className={cn("flex flex-col", className)}>
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className={cn("font-bold tabular-nums", priceClassName)}>
          {formatCurrency((dessert.priceInCents - discount) / 100)}
        </span>
        {discount > 0 && (
          <span className="text-sm tabular-nums text-muted-foreground line-through">
            {formatCurrency(dessert.priceInCents / 100)}
          </span>
        )}
      </span>
      {discount > 0 && (
        <span className="text-xs font-bold text-accent">
          {language === "en" ? "Special offer" : "特价"}
        </span>
      )}
    </span>
  );
}

/**
 * What a dessert's button says to a screen reader: its name in the reader's language,
 * its price, and that it opens the customise dialog.
 */
export function dessertButtonLabel(
  dessert: Priced,
  language: "en" | "zh",
): string {
  const discount = promoDiscountInCents(dessert);
  const price = formatCurrency((dessert.priceInCents - discount) / 100);
  const was = formatCurrency(dessert.priceInCents / 100);
  if (language === "en") {
    return discount > 0
      ? `${dessert.name}, special offer ${price}, was ${was}. Customise and add`
      : `${dessert.name}, ${price}. Customise and add`;
  }
  return discount > 0
    ? `${dessert.chineseName}，特价 ${price}，原价 ${was}。定制并加入购物车`
    : `${dessert.chineseName}，${price}。定制并加入购物车`;
}
