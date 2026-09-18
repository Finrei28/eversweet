import type { PrismaClient } from "@prisma/client";
import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

import {
  checkoutPaymentMetadata,
  repriceCheckoutPayment,
  type StripeForReprice,
} from "./checkoutPayment";
import { CartPricingError } from "./pricing";
import type { PaymentLock } from "./stripeCustomer";

const fake = {
  paymentIntents: {
    retrieve: vi.fn(),
    update: vi.fn(),
    capture: vi.fn(),
    cancel: vi.fn(),
  },
  refunds: { create: vi.fn() },
};
const stripe = fake as unknown as StripeForReprice;

/** Two desserts the shop sells: $6.50 and $4.00, and a $1.00 topping. */
const db = {
  dessert: { findMany: vi.fn() },
  ingredient: { findMany: vi.fn() },
  order: { findUnique: vi.fn() },
};

/** No real lock: records which payment it was taken for. */
const lockedFor: string[] = [];
const lock: PaymentLock = (paymentIntentId, work) => {
  lockedFor.push(paymentIntentId);
  return work();
};

const SECRET = "pi_123_secret_abc";

/** A payment as `/api/checkout_sessions` created it, for a cart of $10.50. */
const payment = (overrides: Record<string, unknown> = {}) => ({
  id: "pi_123",
  client_secret: SECRET,
  status: "requires_payment_method",
  amount: 1050,
  amount_capturable: 0,
  amount_received: 0,
  currency: "nzd",
  metadata: { source: "website", itemCount: "2" },
  latest_charge: null,
  ...overrides,
});

/** The same payment once its card was held for the $10.50 cart. */
const held = (overrides: Record<string, unknown> = {}) =>
  payment({
    status: "requires_capture",
    amount_capturable: 1050,
    latest_charge: { id: "ch_123", amount_refunded: 0 },
    ...overrides,
  });

/** Two mango sago with pearls and a sago: (6.50 + 1.00) x 2 + 4.00 = $19.00. */
const items = [
  {
    dessertId: "mango",
    quantity: 2,
    customisations: [{ id: "pearls", quantity: 1 }],
  },
  { dessertId: "sago", quantity: 1, customisations: [] },
];

const reprice = (secret = SECRET) =>
  repriceCheckoutPayment(
    stripe,
    db as unknown as PrismaClient,
    lock,
    secret,
    items,
  );

const dessertRows = (mangoAvailable = true) => [
  {
    id: "mango",
    name: "Mango Sago",
    priceInCents: 650,
    isAvailableForPurchase: mangoAvailable,
    promoId: null,
    promo: null,
  },
  {
    id: "sago",
    name: "Sago",
    priceInCents: 400,
    isAvailableForPurchase: true,
    promoId: null,
    promo: null,
  },
];

beforeEach(() => {
  for (const resource of Object.values(fake)) {
    for (const spy of Object.values(resource)) spy.mockReset();
  }
  lockedFor.length = 0;
  db.dessert.findMany.mockReset().mockResolvedValue(dessertRows());
  db.ingredient.findMany.mockReset().mockResolvedValue([
    {
      id: "pearls",
      name: "Pearls",
      priceInCents: 100,
      isAvailableForPurchase: true,
    },
  ]);
  db.order.findUnique.mockReset().mockResolvedValue(null);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("repriceCheckoutPayment", () => {
  describe("a payment the card has not been confirmed on", () => {
    it("is set to what the cart costs now, from the database, with its new size", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(payment());

      expect(await reprice()).toEqual({ ok: true, totalInCents: 1900 });
      expect(fake.paymentIntents.update).toHaveBeenCalledWith("pi_123", {
        amount: 1900,
        metadata: { source: "website", itemCount: "3" },
      });
      // Nothing to settle, so no lock.
      expect(lockedFor).toEqual([]);
    });

    it("is not updated when neither its amount nor its size has changed - Pay reprices every time", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(
        payment({
          amount: 1900,
          metadata: { source: "website", itemCount: "3" },
        }),
      );

      expect(await reprice()).toEqual({ ok: true, totalInCents: 1900 });
      expect(fake.paymentIntents.update).not.toHaveBeenCalled();
    });

    it("is updated when only its size has changed", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(
        payment({
          amount: 1900,
          metadata: { source: "website", itemCount: "2" },
        }),
      );

      expect(await reprice()).toEqual({ ok: true, totalInCents: 1900 });
      expect(fake.paymentIntents.update).toHaveBeenCalledWith("pi_123", {
        amount: 1900,
        metadata: { source: "website", itemCount: "3" },
      });
    });

    it("is repriced after a declined card, which leaves it waiting for another", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(
        payment({ last_payment_error: { code: "card_declined" } }),
      );

      expect(await reprice()).toEqual({ ok: true, totalInCents: 1900 });
    });

    it("is repriced while Stripe has a card for it but it is not yet confirmed", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(
        payment({ status: "requires_confirmation" }),
      );

      expect(await reprice()).toEqual({ ok: true, totalInCents: 1900 });
    });

    it("is left alone when the cart has something that has sold out", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(payment());
      db.dessert.findMany.mockResolvedValue(dessertRows(false));

      await expect(reprice()).rejects.toBeInstanceOf(CartPricingError);
      expect(fake.paymentIntents.update).not.toHaveBeenCalled();
    });

    it("is settled like a confirmed one when it is confirmed in the moment it is repriced", async () => {
      fake.paymentIntents.retrieve
        .mockResolvedValueOnce(payment())
        .mockResolvedValue(held());
      fake.paymentIntents.update.mockRejectedValue(
        new Stripe.errors.StripeInvalidRequestError({
          type: "invalid_request_error",
          code: "payment_intent_unexpected_state",
          message: "This PaymentIntent's amount could not be updated",
        }),
      );

      expect(await reprice()).toMatchObject({
        ok: false,
        status: 409,
        refusal: { ok: false, reason: "cart-changed" },
      });
      expect(fake.paymentIntents.cancel).toHaveBeenCalledOnce();
    });
  });

  /**
   * The checkout reprices a confirmed payment only after an order call for it failed. The old
   * payment is settled under its lock by the rules `createNewOrder` uses.
   */
  describe("a payment the card was confirmed on for the old cart", () => {
    it("lets go of a hold for the old total, under the payment's lock, and says so", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(held());

      expect(await reprice()).toMatchObject({
        ok: false,
        status: 409,
        refusal: { ok: false, reason: "cart-changed" },
      });
      expect(lockedFor).toEqual(["pi_123"]);
      expect(fake.paymentIntents.cancel).toHaveBeenCalledWith("pi_123", {
        cancellation_reason: "abandoned",
      });
      expect(fake.paymentIntents.capture).not.toHaveBeenCalled();
    });

    it("keeps a hold that is already for exactly the new cart's total, updating only its size", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(
        held({ amount: 1900, amount_capturable: 1900 }),
      );

      expect(await reprice()).toEqual({ ok: true, totalInCents: 1900 });
      expect(fake.paymentIntents.cancel).not.toHaveBeenCalled();
      expect(fake.paymentIntents.capture).not.toHaveBeenCalled();
      expect(fake.paymentIntents.update).toHaveBeenCalledWith("pi_123", {
        metadata: { source: "website", itemCount: "3" },
      });
    });

    it("sends the checkout to the order when the failed order call was placed after all", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(
        held({
          status: "succeeded",
          amount_capturable: 0,
          amount_received: 1050,
        }),
      );
      db.order.findUnique.mockResolvedValue({ id: "order-1" });

      expect(await reprice()).toMatchObject({
        ok: false,
        status: 409,
        orderId: "order-1",
      });
      expect(fake.refunds.create).not.toHaveBeenCalled();
      expect(fake.paymentIntents.cancel).not.toHaveBeenCalled();
    });

    it("refunds money taken for the old cart that never became an order", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(
        held({
          status: "succeeded",
          amount_capturable: 0,
          amount_received: 1050,
        }),
      );

      expect(await reprice()).toMatchObject({
        ok: false,
        status: 409,
        refusal: { ok: false, reason: "refunded", refundedInCents: 1050 },
      });
      expect(fake.refunds.create).toHaveBeenCalledWith(
        { payment_intent: "pi_123" },
        { idempotencyKey: "order-refund:pi_123" },
      );
    });

    it("lets go of the hold even when the new cart cannot be sold", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(held());
      db.dessert.findMany.mockResolvedValue(dessertRows(false));

      expect(await reprice()).toMatchObject({
        ok: false,
        status: 409,
        refusal: { ok: false, reason: "cart-invalid" },
      });
      expect(fake.paymentIntents.cancel).toHaveBeenCalledOnce();
    });

    it("reports a hold that has already gone as expired", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(
        held({ status: "canceled", amount_capturable: 0 }),
      );

      expect(await reprice()).toMatchObject({
        ok: false,
        status: 409,
        refusal: { ok: false, reason: "expired" },
      });
      expect(fake.paymentIntents.cancel).not.toHaveBeenCalled();
    });

    it.each(["processing", "requires_action"])(
      "touches nothing while the payment is %s",
      async (status) => {
        fake.paymentIntents.retrieve.mockResolvedValue(
          held({ status, amount_capturable: 0 }),
        );

        expect(await reprice()).toMatchObject({ ok: false, status: 409 });
        expect(fake.paymentIntents.update).not.toHaveBeenCalled();
        expect(fake.paymentIntents.cancel).not.toHaveBeenCalled();
        expect(fake.refunds.create).not.toHaveBeenCalled();
      },
    );
  });

  describe("which payments it will touch", () => {
    it("does not find a payment for a string that is not a client secret", async () => {
      expect(await reprice("pi_123")).toMatchObject({ ok: false, status: 404 });
      expect(fake.paymentIntents.retrieve).not.toHaveBeenCalled();
    });

    it("does not find a payment whose client secret is not the one sent", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(
        held({ client_secret: "pi_123_secret_other" }),
      );

      expect(await reprice()).toMatchObject({ ok: false, status: 404 });
      expect(fake.paymentIntents.update).not.toHaveBeenCalled();
      expect(fake.paymentIntents.cancel).not.toHaveBeenCalled();
    });

    it("does not find an app payment - it is the order server's", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(
        held({ metadata: { purpose: "app_order", userId: "user-1" } }),
      );

      expect(await reprice()).toMatchObject({ ok: false, status: 404 });
      expect(fake.paymentIntents.cancel).not.toHaveBeenCalled();
    });

    it("does not find a payment Stripe has never issued", async () => {
      fake.paymentIntents.retrieve.mockRejectedValue(
        new Stripe.errors.StripeInvalidRequestError({
          type: "invalid_request_error",
          code: "resource_missing",
          message: "No such payment_intent",
        }),
      );

      expect(await reprice()).toMatchObject({ ok: false, status: 404 });
    });
  });
});

describe("checkoutPaymentMetadata", () => {
  it("tags the payment as the website's and counts every item, not every line", () => {
    expect(checkoutPaymentMetadata(items)).toEqual({
      source: "website",
      itemCount: "3",
    });
  });
});
