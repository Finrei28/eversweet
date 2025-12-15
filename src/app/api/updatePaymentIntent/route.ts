import { NextResponse } from "next/server";

import { stripe } from "../../../lib/stripe";

export async function POST(req: Request) {
  try {
    const { orderData, paymentIntentId } = await req.json();

    if (!orderData.totalPriceInCents) {
      return NextResponse.json(
        { error: "Amount is required" },
        { status: 400 },
      );
    }
    console.log("updating payment intent for:", orderData);
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
