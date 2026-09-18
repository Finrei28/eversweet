import Stripe from "stripe";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Outside a Next request there is no data cache to write to; read straight through.
vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

import { atNZ } from "~/lib/pickUpTimes";
import { db } from "~/server/db";
import { describeIfDb, resetDatabase } from "~/test/db";
import {
  captureIdempotencyKey,
  placeWebsiteOrder,
  type StripeForOrder,
  type WebsiteOrderInput,
} from "./websiteOrder";

// Thursday 5 March 2026 in Auckland: open 12:30 PM to 9:30 PM, last pick-up 9:20.
const THU = "2026-03-05";
const at = (time: string) =>
  atNZ(THU, Number(time.slice(0, 2)) * 60 + Number(time.slice(3)));
const NOW = at("18:00");

const SECRET = "pi_web_secret_abc";

type FakePayment = {
  id: string;
  client_secret: string;
  status: Stripe.PaymentIntent.Status;
  amount: number;
  amount_capturable: number;
  amount_received: number;
  currency: string;
  metadata: Record<string, string>;
  latest_charge: { id: string; amount_refunded: number };
};

/** What Stripe holds, by id. The fake below moves a payment the way Stripe does. */
const payments = new Map<string, FakePayment>();

const stripeError = (
  code: string,
  message: string,
): Stripe.errors.StripeInvalidRequestError =>
  new Stripe.errors.StripeInvalidRequestError({
    type: "invalid_request_error",
    code,
    message,
  });

const paymentOrThrow = (id: string) => {
  const payment = payments.get(id);
  if (!payment) throw stripeError("resource_missing", "No such payment_intent");
  return payment;
};

const fake = {
  paymentIntents: {
    retrieve: vi.fn(async (id: string) => structuredClone(paymentOrThrow(id))),
    capture: vi.fn(async (id: string) => {
      const payment = paymentOrThrow(id);
      if (payment.status !== "requires_capture") {
        throw stripeError(
          "payment_intent_unexpected_state",
          "This PaymentIntent could not be captured",
        );
      }
      payment.status = "succeeded";
      payment.amount_received = payment.amount_capturable;
      payment.amount_capturable = 0;
      return structuredClone(payment);
    }),
    cancel: vi.fn(async (id: string) => {
      const payment = paymentOrThrow(id);
      payment.status = "canceled";
      payment.amount_capturable = 0;
      return structuredClone(payment);
    }),
  },
  refunds: {
    create: vi.fn(async ({ payment_intent }: { payment_intent: string }) => {
      const payment = paymentOrThrow(payment_intent);
      payment.latest_charge.amount_refunded = payment.amount_received;
      return { id: "re_1" };
    }),
  },
};
const stripe = fake as unknown as StripeForOrder;

/** A website payment the customer has confirmed: the card is held for `amount`. */
const holdCard = (amount: number, overrides: Partial<FakePayment> = {}) => {
  payments.set("pi_web", {
    id: "pi_web",
    client_secret: SECRET,
    status: "requires_capture",
    amount,
    amount_capturable: amount,
    amount_received: 0,
    currency: "nzd",
    metadata: { source: "website", itemCount: "2" },
    latest_charge: { id: "ch_web", amount_refunded: 0 },
    ...overrides,
  });
};

let dessertId = "";

/** Two $7.50 desserts, for pick-up at 7 PM. */
const order = (
  overrides: Partial<WebsiteOrderInput> = {},
): WebsiteOrderInput => ({
  desserts: [
    {
      dessert: { id: dessertId, quantity: 2 },
      priceInCents: 750,
      customisations: [],
    },
  ],
  customerFirstName: "Ada",
  customerLastName: "Lovelace",
  customerEmail: "ada@example.test",
  customerPhoneNumber: "+64211234567",
  totalPriceInCents: 1500,
  pickUpTime: at("19:00"),
  clientSecret: SECRET,
  ...overrides,
});

const place = (input: WebsiteOrderInput = order()) =>
  placeWebsiteOrder(db, stripe, input, NOW);

const ordersWritten = () => db.order.count();

describeIfDb("placeWebsiteOrder", { timeout: 30_000 }, () => {
  beforeEach(async () => {
    await resetDatabase();
    payments.clear();
    for (const resource of Object.values(fake)) {
      for (const spy of Object.values(resource)) spy.mockClear();
    }
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await db.tradingHours.createMany({
      data: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
        weekday,
        opensAt: 750,
        closesAt: 1290,
      })),
    });
    const category = await db.category.create({
      data: { name: "Sago", chineseName: "西米" },
    });
    dessertId = (
      await db.dessert.create({
        data: {
          name: "Mango Sago",
          chineseName: "芒果西米",
          priceInCents: 750,
          imagePath: "https://example.test/mango.png",
          imagePublicId: "products/mango",
          isAvailableForPurchase: true,
          categoryId: category.id,
        },
      })
    ).id;
  });

  it("writes the order and then takes exactly what it costs, once", async () => {
    holdCard(1500);

    const placed = await place();

    expect(placed).toMatchObject({ ok: true, placedNow: true });
    const written = await db.order.findUniqueOrThrow({
      where: { paymentIntentId: "pi_web" },
    });
    expect(written).toMatchObject({ priceInCents: 1500, status: "PENDING" });
    expect(fake.paymentIntents.capture).toHaveBeenCalledOnce();
    expect(fake.paymentIntents.capture).toHaveBeenCalledWith(
      "pi_web",
      {},
      { idempotencyKey: captureIdempotencyKey("pi_web") },
    );
    expect(payments.get("pi_web")?.status).toBe("succeeded");
  });

  it("writes no order for a payment that was never paid", async () => {
    holdCard(1500, { status: "requires_payment_method", amount_capturable: 0 });

    expect(await place()).toEqual({ ok: false, reason: "not-paid" });
    expect(await ordersWritten()).toBe(0);
    expect(fake.paymentIntents.capture).not.toHaveBeenCalled();
  });

  it("writes no order for a client secret that names no payment", async () => {
    await expect(
      place(order({ clientSecret: "pi_made_up_secret_xyz" })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await ordersWritten()).toBe(0);
  });

  it("lets the hold go, and writes nothing, when the cart is not what was held for", async () => {
    holdCard(1500);

    const threeDesserts = order({
      desserts: [
        {
          dessert: { id: dessertId, quantity: 3 },
          priceInCents: 750,
          customisations: [],
        },
      ],
    });

    expect(await place(threeDesserts)).toEqual({
      ok: false,
      reason: "cart-changed",
    });
    expect(await ordersWritten()).toBe(0);
    expect(await db.tempOrderCounter.count()).toBe(0);
    expect(payments.get("pi_web")?.status).toBe("canceled");
    expect(fake.paymentIntents.capture).not.toHaveBeenCalled();
  });

  it("lets the hold go when the shop can no longer take the pick-up time", async () => {
    holdCard(1500);

    expect(await place(order({ pickUpTime: at("21:25") }))).toEqual({
      ok: false,
      reason: "pick-up-time",
      asap: at("18:10"),
    });
    expect(await ordersWritten()).toBe(0);
    expect(payments.get("pi_web")?.status).toBe("canceled");
  });

  it("takes no money when the order cannot be written: the capture comes last", async () => {
    holdCard(1500);
    // The dessert is deleted after the cart was priced, so the order's write fails.
    const retrieve = fake.paymentIntents.retrieve.getMockImplementation()!;
    fake.paymentIntents.retrieve.mockImplementationOnce(async (id: string) => {
      await db.dessert.delete({ where: { id: dessertId } });
      return retrieve(id);
    });

    await expect(place()).rejects.toThrow();
    expect(await ordersWritten()).toBe(0);
    expect(fake.paymentIntents.capture).not.toHaveBeenCalled();
    expect(payments.get("pi_web")?.status).toBe("requires_capture");
  });

  it("leaves no order behind when the hold is gone by the time it is captured", async () => {
    holdCard(1500);
    // Released between the read and the capture - by Stripe, since the sweep takes this lock.
    fake.paymentIntents.capture.mockImplementationOnce(async () => {
      throw stripeError(
        "payment_intent_unexpected_state",
        "This PaymentIntent could not be captured",
      );
    });

    expect(await place()).toEqual({ ok: false, reason: "expired" });
    expect(await ordersWritten()).toBe(0);
    expect(await db.tempOrderCounter.count()).toBe(0);
  });

  it("leaves no order behind when the capture fails outright", async () => {
    holdCard(1500);
    fake.paymentIntents.capture.mockImplementationOnce(async () => {
      throw new Error("Stripe is unreachable");
    });

    await expect(place()).rejects.toThrow("Stripe is unreachable");
    expect(await ordersWritten()).toBe(0);
    expect(payments.get("pi_web")?.status).toBe("requires_capture");
  });

  it("places the order on a retry, without taking the money twice, when the capture went through but the call did not", async () => {
    holdCard(1500);
    const capture = fake.paymentIntents.capture.getMockImplementation()!;
    fake.paymentIntents.capture.mockImplementationOnce(async (id: string) => {
      await capture(id);
      throw new Error("Connection reset after Stripe captured");
    });

    await expect(place()).rejects.toThrow("Connection reset");
    expect(await ordersWritten()).toBe(0);
    expect(payments.get("pi_web")?.status).toBe("succeeded");

    const retried = await place();

    expect(retried).toMatchObject({ ok: true, placedNow: true });
    expect(await ordersWritten()).toBe(1);
    expect(fake.paymentIntents.capture).toHaveBeenCalledOnce();

    // And once more: the order that exists comes back, and nothing is written or taken.
    const again = await place();
    expect(again).toMatchObject({ ok: true, placedNow: false });
    expect(again.ok && retried.ok && again.order.id).toBe(
      retried.ok && retried.order.id,
    );
    expect(await ordersWritten()).toBe(1);
    expect(fake.paymentIntents.capture).toHaveBeenCalledOnce();
  });

  it("refunds a payment already taken when the retry's cart no longer matches", async () => {
    holdCard(1500, {
      status: "succeeded",
      amount_capturable: 0,
      amount_received: 1500,
    });

    const oneDessert = order({
      desserts: [
        {
          dessert: { id: dessertId, quantity: 1 },
          priceInCents: 750,
          customisations: [],
        },
      ],
    });

    expect(await place(oneDessert)).toEqual({
      ok: false,
      reason: "refunded",
      refundedInCents: 1500,
    });
    expect(await ordersWritten()).toBe(0);
    expect(fake.refunds.create).toHaveBeenCalledOnce();
  });

  it("makes two presses of Pay sent together one order and one capture", async () => {
    holdCard(1500);

    const results = await Promise.all([place(), place()]);

    expect(results.map((result) => result.ok)).toEqual([true, true]);
    expect(
      results.map((result) => (result.ok ? result.placedNow : null)).sort(),
    ).toEqual([false, true]);
    expect(await ordersWritten()).toBe(1);
    expect(fake.paymentIntents.capture).toHaveBeenCalledOnce();
  });
});
