import type { CartItem } from "~/app/components/cartContext";

/**
 * A cart as the server prices it: which items, how many, which customisations - never what
 * they cost. What `/api/checkout_sessions` is sent to create the payment and to reprice it.
 */
export const checkoutItems = (cart: CartItem[]) =>
  cart.map((item) => ({
    dessertId: item.dessert.id,
    quantity: item.quantity,
    customisations: item.customisations.map((customisation) => ({
      id: customisation.id,
      quantity: customisation.quantity,
    })),
  }));

/**
 * The cart the payment was last priced for, and what the card will be held for.
 *
 * `key` is the JSON of `checkoutItems` for that cart. While the cart on screen has a
 * different key, the payment is out of date and Pay waits for it to be repriced.
 */
export type PricedCart = { key: string; amountInCents: number };

export const checkoutCartKey = (cart: CartItem[]) =>
  JSON.stringify(checkoutItems(cart));
