"use client";

import Image from "next/image";
import { ShoppingBag, Trash2 } from "lucide-react";

import type { CartContextType, CartItem } from "~/app/components/cartContext";
import { ItemName } from "~/app/components/itemName";
import { useLanguage } from "~/app/components/language";
import { Button } from "~/components/ui/button";
import { formatCurrency } from "~/lib/formatters";
import { summaryPickUpLine } from "~/lib/pickUpLabels";
import { cn } from "~/lib/utils";
import CustomisationDialog from "../../menu/_components/customisation";
import { checkoutCartKey, type PricedCart } from "./checkoutItems";

type orderSummaryProps = {
  cart: CartContextType;
  /** What the server priced this cart at, once it has - see the total below. */
  pricedCart: PricedCart | null;
  pickUpTime: Date | null;
  /** Whether that time is the soonest (ASAP), which is an estimate. */
  pickUpAsap: boolean;
  className?: string;
};

/**
 * What the customer is paying for: a section of the page on a phone, between the pick-up
 * time and their details, and a card beside the form on a wide screen. The pick-up time
 * itself is chosen in its own section above; this only repeats it.
 */
export default function OrderSummary({
  cart,
  pricedCart,
  pickUpTime,
  pickUpAsap,
  className,
}: orderSummaryProps) {
  const { language } = useLanguage();
  const en = language === "en";

  // What the shop will charge, which is the server's number, not this browser's: prices in a
  // cart that has sat in localStorage can be out of date, and the payment is held for what the
  // server prices. Until the server has priced this exact cart - while an edit is still being
  // repriced - the browser's own total is what matches the lines above.
  const totalInCents =
    pricedCart && pricedCart.key === checkoutCartKey(cart.cart)
      ? pricedCart.amountInCents
      : cart.totalPrice;

  return (
    <section
      aria-labelledby="order-summary-heading"
      className={cn(
        "flex flex-col border-b border-border py-6 lg:rounded-card lg:border lg:bg-card lg:p-6",
        className,
      )}
    >
      <h2
        id="order-summary-heading"
        className="text-xl font-extrabold lg:text-[22px]"
      >
        {en ? "Order summary" : "订单摘要"}
      </h2>
      {pickUpTime && (
        <p className="mt-0.5 text-sm tabular-nums text-muted-foreground lg:mt-1 lg:text-[15px]">
          {summaryPickUpLine(pickUpTime, pickUpAsap, language)}
        </p>
      )}

      <ul className="mt-1 lg:mt-2">
        {cart.cart.map((item) => (
          <SummaryLine key={item.id} cart={cart} item={item} />
        ))}
      </ul>

      <div className="flex justify-between pb-1 pt-3.5 text-[15px] text-muted-foreground lg:pb-1.5 lg:pt-4">
        <span>{en ? "GST included" : "包含消费税"}</span>
        <span className="tabular-nums">
          {formatCurrency((totalInCents * 3) / 23 / 100 || 0)}
        </span>
      </div>
      <div className="flex items-baseline justify-between lg:pt-1.5">
        <span className="text-[17px] font-extrabold lg:text-lg">
          {en ? "Total" : "总计"}
        </span>
        <span className="text-2xl font-extrabold tabular-nums lg:text-[26px]">
          {formatCurrency(totalInCents / 100 || 0)}
        </span>
      </div>
    </section>
  );
}

function SummaryLine({
  cart,
  item,
}: {
  cart: CartContextType;
  item: CartItem;
}) {
  const { language } = useLanguage();
  const en = language === "en";

  const priceInCentsBeforeDiscount = item.priceInCents;
  const priceInCentsAfterDiscount =
    priceInCentsBeforeDiscount - item.discountedAmountInCents;
  const discounted = item.discountedAmountInCents > 0;

  return (
    <li className="flex gap-3 border-b border-border py-3.5 lg:gap-3.5 lg:py-4">
      <span className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted lg:h-14 lg:w-14">
        {item.dessert.imagePath ? (
          <Image
            src={item.dessert.imagePath}
            alt=""
            fill
            sizes="56px"
            className="object-cover"
          />
        ) : (
          <ShoppingBag className="h-6 w-6 text-muted-foreground" aria-hidden />
        )}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-px lg:gap-0.5">
        <div className="flex items-start justify-between gap-2">
          <ItemName
            name={item.dessert.name}
            chineseName={item.dessert.chineseName}
          />
          <span className="flex shrink-0 items-baseline gap-1.5 tabular-nums">
            {discounted && (
              <span className="text-[13px] text-muted-foreground line-through">
                {formatCurrency(priceInCentsBeforeDiscount / 100)}
              </span>
            )}
            <span className="text-base font-bold">
              {formatCurrency(
                (discounted
                  ? priceInCentsAfterDiscount
                  : priceInCentsBeforeDiscount) / 100,
              )}
            </span>
          </span>
        </div>

        {item.customisations?.map((customisation) => (
          <p
            key={customisation.id}
            className="flex justify-between gap-2 text-[13px] text-muted-foreground lg:text-sm"
          >
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
              <span className="tabular-nums">
                {customisation.quantity >= 1
                  ? `x${customisation.quantity}`
                  : "-"}
              </span>
              <span
                lang={en ? "en" : "zh-Hans"}
                className={cn(!en && "font-zh font-semibold")}
              >
                {en ? customisation.name : customisation.chineseName}
              </span>
              <span
                lang={en ? "zh-Hans" : "en"}
                className={cn("text-xs", en && "font-zh font-semibold")}
              >
                {en ? customisation.chineseName : customisation.name}
              </span>
            </span>
            <span className="shrink-0 tabular-nums">
              {formatCurrency(
                (customisation.priceInCents * customisation.quantity) / 100,
              )}
            </span>
          </p>
        ))}

        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-muted-foreground lg:text-sm">
            {en ? "Quantity: " : "数量: "}
            {item.quantity}
          </span>
          <span className="-my-1 -mr-2.5 flex">
            <CustomisationDialog dessert={item.dessert} cartItem={item} />
            <Button
              variant="ghost"
              size="round"
              aria-label={
                en
                  ? `Remove ${item.dessert.name}`
                  : `删除${item.dessert.chineseName}`
              }
              className="text-muted-foreground hover:text-destructive"
              onClick={() => cart.removeAllSameItemFromCart(item.id)}
            >
              <Trash2 className="!size-[19px]" strokeWidth={1.8} aria-hidden />
            </Button>
          </span>
        </div>
      </div>
    </li>
  );
}
