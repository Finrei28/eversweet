import { NextResponse } from "next/server";
import { z } from "zod";

import { stripe } from "../../../lib/stripe";
import { withPaymentLock } from "~/server/paymentLock";
import {
  attachCheckoutCustomer,
  checkoutCustomerSchema,
} from "~/server/stripeCustomer";

/**
 * Records who paid on the payment itself, once it has succeeded, so the Stripe Dashboard
 * shows the customer against it. See `~/server/stripeCustomer`.
 *
 * Called with the details as they stood when Pay was pressed, not the debounced ones the
 * payment intent was created from, which the customer may have corrected since.
 *
 * This route used to write whatever `orderData` the browser sent into the metadata of any
 * payment intent it named. Nothing called it and nothing read that metadata.
 */
const requestSchema = z.object({
  clientSecret: z.string().min(1),
  customer: checkoutCustomerSchema,
});

export async function POST(req: Request) {
  try {
    const parsed = requestSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valid customer details are required" },
        { status: 400 },
      );
    }

    const result = await attachCheckoutCustomer(
      stripe,
      parsed.data.clientSecret,
      parsed.data.customer,
      withPaymentLock,
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("updatePaymentIntent error:", error);
    return NextResponse.json(
      { error: "Failed to record customer details" },
      { status: 500 },
    );
  }
}
