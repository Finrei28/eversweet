import { NextResponse } from "next/server";

import { stripe } from "../../../lib/stripe";

export async function POST(req: Request) {
  try {
    const { orderData } = await req.json();

    if (!orderData.totalPriceInCents) {
      return NextResponse.json(
        { error: "Amount is required" },
        { status: 400 },
      );
    }

    const session = await stripe.paymentIntents.create({
      amount: orderData.totalPriceInCents,
      currency: "nzd",
      payment_method_types: ["card"],
      metadata: {
        orderData: orderData,
        webOrder: "true",
      },
    });

    return NextResponse.json(
      { clientSecret: session.client_secret },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json({ error: error }, { status: 500 });
  }
}
