import { NextResponse } from "next/server";

import { stripe } from "../../../lib/stripe";

export async function POST(req: Request) {
  try {
    const { amount } = await req.json();

    if (!amount) {
      return NextResponse.json(
        { error: "Amount is required" },
        { status: 400 },
      );
    }

    const session = await stripe.paymentIntents.create({
      amount: amount,
      currency: "nzd",
      payment_method_types: ["card"],
    });

    return NextResponse.json(
      { clientSecret: session.client_secret },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json({ error: error }, { status: 500 });
  }
}
