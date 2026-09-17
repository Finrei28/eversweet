import "server-only";

import Stripe from "stripe";

import { stripe } from "~/lib/stripe";

/**
 * How many items the payment about to be made is for, as `/api/checkout_sessions` recorded
 * when it priced the cart - or null when that cannot be read.
 *
 * The count decides how long the kitchen is given, so it cannot come from the browser: a
 * page sending `itemCount: 1` would have a large order checked against a single dessert's
 * quote, pay, and keep a pick-up time the kitchen could not meet.
 *
 * Its own module, away from `./pickUpTimes`, because `~/lib/stripe` builds the client the
 * moment it is imported and throws without `STRIPE_SECRET_KEY`. CI has no key, and
 * `pickUpTimes` is imported by `createNewOrder` and by its database suite - so it keeps no
 * Stripe import, and only the router that needs this pays for it.
 */
export const itemCountForPayment = async (
  paymentIntentId: string,
): Promise<number | null> => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const itemCount = Number(paymentIntent.metadata?.itemCount);
    return Number.isInteger(itemCount) && itemCount > 0 ? itemCount : null;
  } catch (error) {
    // A payment Stripe does not know gets the most cautious quote; anything else is worth
    // seeing in the logs.
    if (
      !(error instanceof Stripe.errors.StripeInvalidRequestError) ||
      error.code !== "resource_missing"
    ) {
      console.error("Could not read a payment's item count:", error);
    }
    return null;
  }
};
