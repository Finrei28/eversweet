/**
 * What a dessert's promotion takes off its price, in cents: a fixed amount as it is, a
 * percentage rounded down to the cent. The menu, the popular choices and the customise
 * dialog each wrote this out inline; they share it now, with the same arithmetic.
 *
 * Display and the cart line only. What an order costs is worked out again on the
 * server (`src/server/pricing.ts`), from the database.
 */
export const promoDiscountInCents = ({
  priceInCents,
  promo,
}: {
  priceInCents: number;
  promo: { type: "PERCENTAGE" | "FIXED_AMOUNT"; value: number } | null;
}): number =>
  promo
    ? promo.type === "FIXED_AMOUNT"
      ? promo.value
      : Math.floor(priceInCents * (promo.value / 100))
    : 0;
