import { NextResponse } from "next/server";

import { stripe } from "../../../lib/stripe";

export async function POST(req: Request) {
  try {
    const { orderData, paymentIntentId } = await req.json();

    const paymentIntent = await stripe.paymentIntents.update(paymentIntentId, {
      metadata: {
        orderData: JSON.stringify(orderData),
        webOrder: "true",
      },
    });

    return NextResponse.json(
      { paymentIntentId: paymentIntent.id },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json({ error: error }, { status: 500 });
  }
}
