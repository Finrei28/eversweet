import "server-only";

import type { PrismaClient } from "@prisma/client";
import Stripe from "stripe";
import { z } from "zod";

import { CartPricingError, priceCart } from "~/server/pricing";
import {
  paymentIntentIdFromClientSecret,
  WEBSITE_SOURCE,
  type PaymentLock,
} from "~/server/stripeCustomer";
import {
  settleWebsitePayment,
  type OrderRefusal,
  type StripeForOrder,
} from "~/server/websiteOrder";

/**
 * The website's payment as the checkout page holds it, from the cart's first pricing to the
 * last edit before Pay.
 *
 * The amount is always computed here, from the database: the browser sends only what is in
 * the cart - which items, how many, which customisations. Stripe is passed in rather than
 * imported, because `~/lib/stripe` throws on import without `STRIPE_SECRET_KEY` and CI has
 * none.
 */

export const checkoutItemsSchema = z
  .array(
    z.object({
      dessertId: z.string().min(1),
      quantity: z.number().int().positive(),
      customisations: z
        .array(
          z.object({
            id: z.string().min(1),
            quantity: z.number().int().nonnegative(),
          }),
        )
        .default([]),
    }),
  )
  .min(1);

export type CheckoutItems = z.output<typeof checkoutItemsSchema>;

/** Creating a payment: `POST /api/checkout_sessions`. */
export const createPaymentRequestSchema = z.object({
  items: checkoutItemsSchema,
});

/** Repricing it after the cart changes: `PUT /api/checkout_sessions`. */
export const repricePaymentRequestSchema = z.object({
  clientSecret: z.string().min(1),
  items: checkoutItemsSchema,
});

/**
 * Written on the payment when it is created and again whenever it is repriced.
 *
 * `source` is what every route acting on a website payment requires of it. `itemCount` is
 * how big the kitchen's job is, from the cart just priced: the pick-up time check before
 * paying reads it from here rather than trusting a count the browser sends - see
 * `itemCountForPayment` in ~/server/paymentItemCount.
 */
export const checkoutPaymentMetadata = (items: CheckoutItems) => ({
  source: WEBSITE_SOURCE,
  itemCount: String(items.reduce((count, item) => count + item.quantity, 0)),
});

/** A payment's amount can change only until the card is confirmed. */
const REPRICEABLE: ReadonlySet<Stripe.PaymentIntent.Status> = new Set([
  "requires_payment_method",
  "requires_confirmation",
]);

/**
 * The Stripe calls made here - narrow, so a test can hand in a fake. Settling a confirmed
 * payment can release its hold or refund it, as `createNewOrder` can.
 */
export type StripeForReprice = StripeForOrder & {
  paymentIntents: Pick<Stripe["paymentIntents"], "update">;
};

export type RepriceResult =
  | { ok: true; totalInCents: number }
  | { ok: false; status: 400 | 404; error: string }
  | {
      ok: false;
      status: 409;
      error: string;
      /** An order was placed with this payment after all: the checkout goes to it. */
      orderId?: string;
      /** What became of a payment confirmed for the old cart - released, refunded or expired. */
      refusal?: OrderRefusal;
    };

/**
 * Brings a checkout's payment up to date with its cart, so the amount the card is held for
 * is what the cart costs now.
 *
 * The checkout page used to create the payment once, when the customer's details were
 * complete, and never touch it again. The cart can still be edited and emptied on that page,
 * so a customer who took an item out paid for it anyway, and one who added an item got it
 * for nothing.
 *
 * Anything but a website payment the browser holds the client secret for is "not found".
 * Nothing takes the payment lock while the amount can still change - the order check compares
 * the held amount with the cart under it, so an edit that races Pay is caught there.
 *
 * **Once the card has been confirmed** Stripe will not change the amount, and the checkout
 * starts a new payment. The checkout only reprices then after an order call for this payment
 * failed, so the old one is settled first, under its lock, by the same rules `createNewOrder`
 * uses (`settleWebsitePayment`):
 * - if the order call committed after all and only its answer was lost, the checkout is sent
 *   to that order (`orderId`) rather than taking payment a second time;
 * - a hold for a different amount is let go, and money already taken is refunded, rather than
 *   left on the customer's card until the order server's sweep finds it;
 * - a hold for exactly the new cart's total is kept - pressing Pay places the order with it.
 *
 * Throws `CartPricingError` for a cart that cannot be sold while the amount can still change,
 * as `priceCart` does.
 */
export async function repriceCheckoutPayment(
  stripe: StripeForReprice,
  db: PrismaClient,
  lock: PaymentLock,
  clientSecret: string,
  items: CheckoutItems,
): Promise<RepriceResult> {
  const notFound = {
    ok: false,
    status: 404,
    error: "Payment not found",
  } as const;

  const paymentIntentId = paymentIntentIdFromClientSecret(clientSecret);
  if (!paymentIntentId) return notFound;

  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (error) {
    if (
      error instanceof Stripe.errors.StripeInvalidRequestError &&
      error.code === "resource_missing"
    ) {
      return notFound;
    }
    throw error;
  }

  if (
    paymentIntent.client_secret !== clientSecret ||
    paymentIntent.metadata?.source !== WEBSITE_SOURCE
  ) {
    return notFound;
  }

  const repriceable = REPRICEABLE.has(paymentIntent.status);

  let cart: { totalInCents: number } | { problem: string };
  try {
    cart = { totalInCents: (await priceCart(db, items)).totalInCents };
  } catch (error) {
    if (repriceable || !(error instanceof CartPricingError)) throw error;
    cart = { problem: error.message };
  }

  if ("totalInCents" in cart && cart.totalInCents <= 0) {
    return {
      ok: false,
      status: 400,
      error: "Cart total must be greater than zero",
    };
  }

  if (repriceable && "totalInCents" in cart) {
    const metadata = checkoutPaymentMetadata(items);

    // The checkout reprices on every press of Pay as well as on every edit, so the usual
    // answer is that nothing has changed.
    if (
      paymentIntent.amount === cart.totalInCents &&
      paymentIntent.metadata?.itemCount === metadata.itemCount
    ) {
      return { ok: true, totalInCents: cart.totalInCents };
    }

    try {
      await stripe.paymentIntents.update(paymentIntent.id, {
        amount: cart.totalInCents,
        metadata,
      });
      return { ok: true, totalInCents: cart.totalInCents };
    } catch (error) {
      // Confirmed in the moment since it was read: settled below like any confirmed payment.
      if (
        !(error instanceof Stripe.errors.StripeInvalidRequestError) ||
        error.code !== "payment_intent_unexpected_state"
      ) {
        throw error;
      }
    }
  }

  const settled = await lock(paymentIntent.id, () =>
    settleWebsitePayment(stripe, db, {
      paymentIntentId: paymentIntent.id,
      clientSecret,
      cart,
      // The pick-up time is the order's to check; this only asks whether the payment still
      // pays for the cart.
      pickUpProblem: null,
    }),
  );

  if ("orderId" in settled) {
    return {
      ok: false,
      status: 409,
      error: "This payment has already been used for an order",
      orderId: settled.orderId,
    };
  }

  // Already held, or taken, for exactly what the new cart costs: only its size can have
  // changed, which the pick-up time check reads from here.
  if ("capture" in settled && "totalInCents" in cart) {
    await stripe.paymentIntents.update(paymentIntent.id, {
      metadata: checkoutPaymentMetadata(items),
    });
    return { ok: true, totalInCents: cart.totalInCents };
  }

  return {
    ok: false,
    status: 409,
    error: "This payment can no longer be changed",
    ...("refusal" in settled ? { refusal: settled.refusal } : {}),
  };
}
