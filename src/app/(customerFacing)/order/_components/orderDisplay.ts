/**
 * What the order page works out before it draws anything, moved out of the page unchanged so
 * that a test can hold it while the markup around it is rewritten.
 */

/** How long a confirmed order's receipt stays up: a day from when it was placed. */
export const ORDER_PAGE_LIFETIME_MS = 24 * 60 * 60 * 1000;

export type OrderPageState =
  | "cancelled"
  | "picked-up"
  | "not-found"
  | "confirmed";

/**
 * Which of its four states the page shows. A cancelled or collected order says so however
 * old it is; anything else is "not found" once the read has failed, when there is no such
 * order, or more than a day after it was placed.
 */
export const orderPageState = (
  order: { status: string; createdAt: Date } | null | undefined,
  failed: boolean,
  now: number,
): OrderPageState => {
  if (order?.status === "CANCELLED") return "cancelled";
  if (order?.status === "PICKED_UP") return "picked-up";
  if (
    failed ||
    !order ||
    now - new Date(order.createdAt).getTime() > ORDER_PAGE_LIFETIME_MS
  ) {
    return "not-found";
  }
  return "confirmed";
};

type ReceiptLine = {
  quantity: number;
  discountedAmountInCents: number;
  dessert: { priceInCents: number };
  customisations: {
    quantity: number;
    customisation: { priceInCents: number };
  }[];
};

/**
 * One receipt line's price, each and for the line: the dessert less its discount, plus every
 * topping times its count. In cents, so the line total is exact; the page used to multiply
 * dollars.
 */
export const linePrices = (
  item: ReceiptLine,
): { eachInCents: number; lineInCents: number } => {
  const eachInCents =
    item.dessert.priceInCents -
    item.discountedAmountInCents +
    item.customisations.reduce(
      (total, { quantity, customisation }) =>
        total + customisation.priceInCents * quantity,
      0,
    );
  return { eachInCents, lineInCents: eachInCents * item.quantity };
};

/** "+ 2" before a topping added twice, "+" once, and "-" before one taken out. */
export const customisationPrefix = (quantity: number): string =>
  quantity > 1 ? `+ ${quantity}` : quantity === 1 ? "+" : "-";
