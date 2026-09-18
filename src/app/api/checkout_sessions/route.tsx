import { NextResponse } from "next/server";

import { stripe } from "../../../lib/stripe";
import {
  checkoutPaymentMetadata,
  createPaymentRequestSchema,
  repricePaymentRequestSchema,
  repriceCheckoutPayment,
} from "~/server/checkoutPayment";
import { db } from "~/server/db";
import { withPaymentLock } from "~/server/paymentLock";
import { CartPricingError, priceCart } from "~/server/pricing";

/**
 * The checkout's payment: created once the customer's details are complete (`POST`), and
 * repriced whenever the cart changes after that (`PUT`). See `~/server/checkoutPayment`.
 *
 * The amount to charge is computed here, from the database. This route previously took
 * `totalPriceInCents` straight from the request body and handed it to Stripe, so the
 * browser decided what it paid. It now accepts only the contents of the cart.
 *
 * The card is only **held** when the customer pays (`capture_method: "manual"`). The money
 * is taken when `createNewOrder` writes the order, and only if the amount held is what the
 * cart it is sent costs - see `~/server/websiteOrder`.
 */
export async function POST(req: Request) {
  try {
    const parsed = createPaymentRequestSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "A valid cart is required" },
        { status: 400 },
      );
    }

    const { totalInCents } = await priceCart(db, parsed.data.items);

    if (totalInCents <= 0) {
      return NextResponse.json(
        { error: "Cart total must be greater than zero" },
        { status: 400 },
      );
    }

    const session = await stripe.paymentIntents.create({
      amount: totalInCents,
      currency: "nzd",
      payment_method_types: ["card"],
      capture_method: "manual",
      metadata: checkoutPaymentMetadata(parsed.data.items),
    });

    return NextResponse.json(
      {
        clientSecret: session.client_secret,
        paymentIntentId: session.id,
        // What the card will be held for, which the Pay button shows. The browser's own
        // total can be out of date if the cart sat in localStorage.
        totalInCents,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof CartPricingError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("checkout_sessions error:", error);
    return NextResponse.json(
      { error: "Failed to initialise payment" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const parsed = repricePaymentRequestSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "A valid cart is required" },
        { status: 400 },
      );
    }

    const result = await repriceCheckoutPayment(
      stripe,
      db,
      withPaymentLock,
      parsed.data.clientSecret,
      parsed.data.items,
    );

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          ...(result.status === 409
            ? { orderId: result.orderId, refusal: result.refusal }
            : {}),
        },
        { status: result.status },
      );
    }

    return NextResponse.json(
      { totalInCents: result.totalInCents },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof CartPricingError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("checkout_sessions reprice error:", error);
    return NextResponse.json(
      { error: "Failed to update payment" },
      { status: 500 },
    );
  }
}
