import { NextResponse } from "next/server";
import { z } from "zod";

import { stripe } from "../../../lib/stripe";
import { db } from "~/server/db";
import { CartPricingError, priceCart } from "~/server/pricing";

/**
 * The amount to charge is computed here, from the database.
 *
 * This route previously took `totalPriceInCents` straight from the request
 * body and handed it to Stripe, so the browser decided what it paid. It now
 * accepts only the contents of the cart - which items, how many, which
 * customisations - and prices them itself.
 */
const cartRequestSchema = z.object({
  items: z
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
    .min(1),
});

export async function POST(req: Request) {
  try {
    const parsed = cartRequestSchema.safeParse(await req.json());

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
    });

    return NextResponse.json(
      {
        clientSecret: session.client_secret,
        paymentIntentId: session.id,
        // So the checkout UI can tell the customer if the price moved while
        // their cart sat in localStorage.
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
