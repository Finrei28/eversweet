import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { formatInTimeZone } from "date-fns-tz";
import Stripe from "stripe";
import type { z } from "zod";

import type { createOrderSchema } from "~/app/components/schemas";
import { lockPayment } from "~/server/paymentLock";
import {
  checkWebsitePickUpTime,
  type WebsitePickUpCheck,
} from "~/server/pickUpTimes";
import {
  CartPricingError,
  gstInCentsFromInclusiveTotal,
  priceCart,
} from "~/server/pricing";
import {
  paymentIntentIdFromClientSecret,
  WEBSITE_SOURCE,
} from "~/server/stripeCustomer";

/**
 * Placing a website order against the payment that pays for it.
 *
 * `createNewOrder` used to take a payment intent id on trust. It never asked Stripe about
 * it, so anyone could call the procedure directly with any id - or none that was ever
 * paid - and put an order on the kitchen's screen. And because the checkout never updated
 * its payment after the cart was edited, a customer who changed their cart paid the old
 * total for the new one. Neither side ever compared what was paid with what was ordered.
 *
 * Now the card is **held** when the customer pays (`capture_method: "manual"` in
 * `/api/checkout_sessions`), and the money is taken here, as the last step before the order
 * commits, only once the hold is found to be for exactly what the order costs. Until then
 * nothing has moved, so a cart that changed, or a pick-up time the shop can no longer take,
 * is refused by letting the hold go: no refund, no fee, nothing on the customer's statement.
 *
 * This is the order server's `settleOrderPayment` (its `lib/orderPayment`) for website
 * payments, and the two agree on what they share: the advisory lock on the payment, and the
 * idempotency keys for capturing and refunding. The order server's stranded-payment sweep
 * settles website payments too, under that lock - releasing a hold whose order never came,
 * and refunding money taken with no order.
 *
 * Stripe is passed in, never imported: `~/lib/stripe` throws on import without a key.
 */

/** The only currency the shop charges in. */
export const CHARGE_CURRENCY = "nzd";

/** The Stripe calls made here - narrow, so a test can hand in a fake. */
export type StripeForOrder = {
  paymentIntents: Pick<
    Stripe["paymentIntents"],
    "retrieve" | "capture" | "cancel"
  >;
  refunds: Pick<Stripe["refunds"], "create">;
};

/**
 * Why an order was not placed. Returned rather than thrown so the checkout can word each one
 * in both languages. Every one but `not-paid` leaves the payment unusable - released,
 * refunded or expired - and the checkout starts a new one.
 */
export type OrderRefusal =
  /** The hold is not for what the cart costs now. The hold was released. */
  | { ok: false; reason: "cart-changed" }
  /** Something in the cart has been removed since. The hold was released. */
  | { ok: false; reason: "cart-invalid"; message: string }
  /** The shop can no longer take the pick-up time. The hold was released. */
  | { ok: false; reason: "pick-up-time"; asap: Date | null }
  /** The hold was gone before the order came: released by the sweep, or lapsed. */
  | { ok: false; reason: "expired" }
  /** The money had been taken and has been handed back, in full. */
  | { ok: false; reason: "refunded"; refundedInCents: number }
  /** The card has not been confirmed. The payment can still be paid. */
  | { ok: false; reason: "not-paid" };

export type WebsiteOrderInput = z.output<typeof createOrderSchema>;

/**
 * What the confirmation email is rendered from. The select `createNewOrder` has always used,
 * moved here with the write.
 */
const placedOrderSelect = {
  id: true,
  tempOrderId: true,
  status: true,
  createdAt: true,
  customerFirstName: true,
  customerLastName: true,
  customerEmail: true,
  customerPhoneNumber: true,
  priceInCents: true,
  discountedAmountInCents: true,
  pickUpTime: true,
  dineIn: true,
  pickedUpAt: true,
  GST: true,
  notified: true,
  appUserId: true,
  desserts: {
    select: {
      orderId: true,
      id: true,
      quantity: true,
      priceInCents: true,
      discountedAmountInCents: true,
      dessert: {
        select: {
          id: true,
          name: true,
          chineseName: true,
          imagePath: true,
        },
      },
      customisations: {
        select: {
          id: true,
          quantity: true,
          discountedAmountInCents: true,
          customisation: {
            select: {
              id: true,
              name: true,
              chineseName: true,
              priceInCents: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.OrderSelect;

export type PlacedOrder = Prisma.OrderGetPayload<{
  select: typeof placedOrderSelect;
}>;

export type PlaceWebsiteOrderResult =
  /** `placedNow` is false for a retry that found its order already written. */
  { ok: true; order: PlacedOrder; placedNow: boolean } | OrderRefusal;

/**
 * The capture's idempotency key, and the refund's - the same as the order server's sweep
 * uses for the same payment, with the same parameters, so however a retry here and the
 * sweep interleave, a payment is captured once and refunded once.
 */
export const captureIdempotencyKey = (paymentIntentId: string) =>
  `order-capture:${paymentIntentId}`;
export const refundIdempotencyKey = (paymentIntentId: string) =>
  `order-refund:${paymentIntentId}`;

/** Thrown out of the order's transaction, to roll it back, when the hold is gone by capture. */
class HoldReleasedError extends Error {}

/** One answer for a payment that does not exist and one that is not the caller's. */
const paymentNotFound = () =>
  new TRPCError({ code: "NOT_FOUND", message: "Payment not found" });

/**
 * How much of a payment has been handed back. A refund leaves a payment intent reading
 * "succeeded", so this is the only thing that stops a refunded payment buying an order.
 * Needs the charge expanded; an id where the charge should be throws rather than reading as
 * "nothing refunded".
 */
const refundedInCents = (intent: Stripe.PaymentIntent): number => {
  const charge = intent.latest_charge;
  if (charge == null) return 0;
  if (typeof charge === "string") {
    throw new Error(
      `Payment ${intent.id} was read without its charge expanded`,
    );
  }
  return charge.amount_refunded;
};

export type PaymentSettlement =
  | { refusal: OrderRefusal }
  /** The payment already has its order: a retry of a call that succeeded. */
  | { orderId: string }
  /** The order may be written - with the hold to capture last, or null if already taken. */
  | { capture: string | null };

/**
 * Decides whether a payment pays for this order. Runs inside the order's transaction, under
 * the payment's lock, before anything is written.
 *
 * - **On hold** (the normal case): the order goes ahead only if the hold is for exactly what
 *   the cart costs, in NZD, and the pick-up time can still be taken. Anything else lets the
 *   hold go.
 * - **Already taken** reaches here through one gap only: the capture succeeded and the
 *   order's commit then failed, since Stripe and Postgres cannot commit together. A retry
 *   with the same cart is accepted without capturing again - and with a pick-up time that
 *   has since passed, because the money is taken. One that no longer matches is refunded
 *   in full, never accepted at the amount paid, which would honour exactly the tampering
 *   this exists to stop.
 */
export async function settleWebsitePayment(
  stripe: StripeForOrder,
  tx: Pick<Prisma.TransactionClient, "order">,
  {
    paymentIntentId,
    clientSecret,
    cart,
    pickUpProblem,
  }: {
    paymentIntentId: string;
    clientSecret: string;
    /** What the cart costs now, or why it cannot be sold at all. */
    cart: { totalInCents: number } | { problem: string };
    /** The soonest time that could be taken instead, or null if the time asked for is fine. */
    pickUpProblem: { asap: Date | null } | null;
  },
): Promise<PaymentSettlement> {
  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });
  } catch (error) {
    if (
      error instanceof Stripe.errors.StripeInvalidRequestError &&
      error.code === "resource_missing"
    ) {
      throw paymentNotFound();
    }
    throw error;
  }

  if (
    intent.client_secret !== clientSecret ||
    intent.metadata?.source !== WEBSITE_SOURCE
  ) {
    throw paymentNotFound();
  }

  // After the secret check, so this cannot be used to find another customer's order. Under
  // the lock, so an order a concurrent call committed is visible.
  const existing = await tx.order.findUnique({
    where: { paymentIntentId },
    select: { id: true },
  });

  if (existing) {
    // Not a state this module leaves - the capture comes before the order commits - so it
    // is logged loudly. The order is real; the sweep captures a hold that has an order.
    if (intent.status === "requires_capture") {
      console.error(
        `Payment ${intent.id} is still on hold but already has order ${existing.id}; left for the sweep to capture.`,
      );
    }
    return { orderId: existing.id };
  }

  const pays = (amountInCents: number) =>
    "totalInCents" in cart &&
    amountInCents === cart.totalInCents &&
    intent.currency === CHARGE_CURRENCY;

  const worth =
    "totalInCents" in cart
      ? `cart is worth ${cart.totalInCents} ${CHARGE_CURRENCY}`
      : `cart cannot be sold (${cart.problem})`;

  if (intent.status === "requires_capture") {
    if (pays(intent.amount_capturable) && !pickUpProblem) {
      return { capture: intent.id };
    }

    await stripe.paymentIntents.cancel(intent.id, {
      cancellation_reason: "abandoned",
    });

    if ("problem" in cart) {
      console.error(
        `Released the hold on website payment ${intent.id}: ${worth}. No order was created.`,
      );
      return {
        refusal: { ok: false, reason: "cart-invalid", message: cart.problem },
      };
    }

    if (!pays(intent.amount_capturable)) {
      console.error(
        `Released the hold on website payment ${intent.id}: held ${intent.amount_capturable} ${intent.currency}, ${worth}. No order was created.`,
      );
      return { refusal: { ok: false, reason: "cart-changed" } };
    }

    return {
      refusal: {
        ok: false,
        reason: "pick-up-time",
        asap: pickUpProblem?.asap ?? null,
      },
    };
  }

  if (intent.status === "canceled") {
    return { refusal: { ok: false, reason: "expired" } };
  }

  if (intent.status !== "succeeded") {
    return { refusal: { ok: false, reason: "not-paid" } };
  }

  // Taken already: the capture-to-commit gap described above.
  const refunded = refundedInCents(intent);
  if (refunded > 0) {
    return {
      refusal: { ok: false, reason: "refunded", refundedInCents: refunded },
    };
  }

  if (pays(intent.amount_received)) return { capture: null };

  await stripe.refunds.create(
    { payment_intent: intent.id },
    { idempotencyKey: refundIdempotencyKey(intent.id) },
  );

  console.error(
    `Refunded website payment ${intent.id}: paid ${intent.amount_received} ${intent.currency}, ${worth}. No order was created.`,
  );

  return {
    refusal: {
      ok: false,
      reason: "refunded",
      refundedInCents: intent.amount_received,
    },
  };
}

/**
 * Takes the money for an order, as the last step of its transaction, so a capture that fails
 * leaves no order behind. Keyed, so a retry after a lost response cannot take it twice.
 */
async function captureHold(stripe: StripeForOrder, paymentIntentId: string) {
  try {
    await stripe.paymentIntents.capture(
      paymentIntentId,
      {},
      { idempotencyKey: captureIdempotencyKey(paymentIntentId) },
    );
  } catch (error) {
    if (
      error instanceof Stripe.errors.StripeInvalidRequestError &&
      error.code === "payment_intent_unexpected_state"
    ) {
      throw new HoldReleasedError(
        `Payment ${paymentIntentId} was no longer on hold when its order was placed`,
      );
    }
    throw error;
  }
}

/**
 * Writes a website order against its payment, taking the money as the last step.
 *
 * Throws NOT_FOUND for a client secret that does not name one of the website's payments.
 * Every other reason not to place the order is returned - see `OrderRefusal`.
 */
export async function placeWebsiteOrder(
  db: PrismaClient,
  stripe: StripeForOrder,
  orderData: WebsiteOrderInput,
  now: Date = new Date(),
): Promise<PlaceWebsiteOrderResult> {
  const paymentIntentId = paymentIntentIdFromClientSecret(
    orderData.clientSecret,
  );
  if (!paymentIntentId) throw paymentNotFound();

  // Priced from the database, never from the amounts the browser sent. Availability is not
  // enforced: an item selling out in the moments between the last repricing and Pay does not
  // stop an order the customer has already been held for. An item that no longer exists
  // does, and releases the hold - there is nothing to make.
  let pricing: Awaited<ReturnType<typeof priceCart>> | null = null;
  let cartProblem: string | null = null;
  try {
    pricing = await priceCart(
      db,
      orderData.desserts.map((item) => ({
        dessertId: item.dessert.id,
        quantity: item.dessert.quantity,
        customisations: item.customisations.map((customisation) => ({
          id: customisation.id,
          quantity: customisation.quantity,
        })),
      })),
      { now, requireAvailable: false },
    );
  } catch (error) {
    if (!(error instanceof CartPricingError)) throw error;
    cartProblem = error.message;
  }

  // The checkout asked the server about this time before paying. One that fails now got past
  // that - a stale page, a tampered request, or last orders passing mid-payment - and the
  // hold is let go. A check that cannot be read refuses nothing: the shop's hours failing to
  // load is no reason to turn away a customer who has paid.
  const pickUpCheck: WebsitePickUpCheck | null = pricing
    ? await checkWebsitePickUpTime(
        orderData.pickUpTime,
        orderData.desserts.reduce((n, item) => n + item.dessert.quantity, 0),
        now,
      ).catch((error: unknown) => {
        console.error("Could not check an order's pick-up time:", error);
        return null;
      })
    : null;

  const pickUpProblem =
    pickUpCheck && !pickUpCheck.ok ? { asap: pickUpCheck.asap } : null;

  let result: PlaceWebsiteOrderResult;
  try {
    result = await db.$transaction(
      async (tx): Promise<PlaceWebsiteOrderResult> => {
        // Held from the Stripe read to the commit, so of two calls racing on one payment -
        // a double click, a retry, or the sweep - whichever comes second sees the first's
        // outcome.
        await lockPayment(tx, paymentIntentId);

        const settled = await settleWebsitePayment(stripe, tx, {
          paymentIntentId,
          clientSecret: orderData.clientSecret,
          cart: pricing
            ? { totalInCents: pricing.totalInCents }
            : { problem: cartProblem ?? "The cart could not be priced." },
          pickUpProblem,
        });

        if ("refusal" in settled) return settled.refusal;

        if ("orderId" in settled) {
          return {
            ok: true,
            placedNow: false,
            order: await tx.order.findUniqueOrThrow({
              where: { id: settled.orderId },
              select: placedOrderSelect,
            }),
          };
        }

        // Settlement lets only a priced cart through.
        if (!pricing)
          throw new Error("An unpriced cart reached the order write");

        const order = await writeOrder(tx, orderData, pricing, paymentIntentId);

        // The money is taken last. A capture that fails throws, and the order rolls back
        // with it. If the capture succeeds and the commit then fails, the retry finds the
        // payment taken and places the order without capturing again.
        if (settled.capture) await captureHold(stripe, settled.capture);

        return { ok: true, placedNow: true, order };
      },
      // Stripe calls run inside the transaction, past Prisma's 5-second default.
      { maxWait: 10_000, timeout: 20_000 },
    );
  } catch (error) {
    if (error instanceof HoldReleasedError) {
      console.error(error.message);
      return { ok: false, reason: "expired" };
    }
    throw error;
  }

  // Only reachable through the already-taken path, which accepts a late time rather than
  // turning away money already taken.
  if (result.ok && result.placedNow && pickUpCheck && !pickUpCheck.ok) {
    console.error(
      `Order ${result.order.id} (#${result.order.tempOrderId}) was accepted with a pick-up time the shop cannot take (${pickUpCheck.reason}, ${result.order.pickUpTime.toISOString()}) because payment ${paymentIntentId} was already taken.`,
    );
  }

  return result;
}

async function writeOrder(
  tx: Prisma.TransactionClient,
  orderData: WebsiteOrderInput,
  pricing: Awaited<ReturnType<typeof priceCart>>,
  paymentIntentId: string,
): Promise<PlacedOrder> {
  const pickUpNZDate = formatInTimeZone(
    new Date(orderData.pickUpTime),
    "Pacific/Auckland",
    "yyyy-MM-dd",
  );

  let counter = await tx.tempOrderCounter.findUnique({
    where: { date: pickUpNZDate },
  });

  if (!counter) {
    counter = await tx.tempOrderCounter.create({
      data: {
        date: pickUpNZDate,
        counter: 6000,
      },
    });
  } else {
    counter = await tx.tempOrderCounter.update({
      where: { date: pickUpNZDate },
      data: { counter: counter.counter + 1 },
    });
  }

  return tx.order.create({
    data: {
      tempOrderId: counter.counter.toString(),
      customerFirstName: orderData.customerFirstName ?? "",
      customerLastName: orderData.customerLastName ?? "",
      customerEmail: orderData.customerEmail,
      customerPhoneNumber: orderData.customerPhoneNumber,
      source: "WEBSITE",
      priceInCents: pricing.totalInCents,
      // Kept on the server-priced total rather than the client's number, and rounded
      // because GST is an Int column.
      GST: gstInCentsFromInclusiveTotal(pricing.totalInCents),
      pickUpTime: orderData.pickUpTime,
      dineIn: false,
      status: "PENDING",
      paymentIntentId,
      desserts: {
        create: orderData.desserts.map((dessertItem, index) => ({
          dessert: {
            connect: {
              id: dessertItem.dessert.id, // Ensure dessert exists before connecting
            },
          },

          quantity: dessertItem.dessert.quantity,
          // Server-priced, in the same order as the input lines.
          priceInCents: pricing.lines[index]!.unitPriceInCents,
          discountedAmountInCents:
            pricing.lines[index]!.discountedAmountInCents,
          promoId: pricing.lines[index]!.promoId,
          customisations: {
            create: dessertItem.customisations.map((customisationsItem) => ({
              customisation: {
                connect: {
                  id: customisationsItem.id, // Ensure customisation exists before connecting
                },
              },
              quantity: customisationsItem.quantity,
            })),
          },
        })),
      },
    },
    select: placedOrderSelect,
  });
}
