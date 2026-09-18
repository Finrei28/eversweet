import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

import {
  captureIdempotencyKey,
  refundIdempotencyKey,
  settleWebsitePayment,
  type StripeForOrder,
} from "./websiteOrder";

const fake = {
  paymentIntents: { retrieve: vi.fn(), capture: vi.fn(), cancel: vi.fn() },
  refunds: { create: vi.fn() },
};
const stripe = fake as unknown as StripeForOrder;

const findUnique = vi.fn();
const tx = { order: { findUnique } } as unknown as Parameters<
  typeof settleWebsitePayment
>[1];

const SECRET = "pi_123_secret_abc";

/** A website payment as `/api/checkout_sessions` creates it, once the browser has paid. */
const held = (overrides: Record<string, unknown> = {}) => ({
  id: "pi_123",
  client_secret: SECRET,
  status: "requires_capture",
  amount: 1500,
  amount_capturable: 1500,
  amount_received: 0,
  currency: "nzd",
  metadata: { source: "website", itemCount: "2" },
  latest_charge: { id: "ch_123", amount_refunded: 0 },
  ...overrides,
});

/** The same payment after its capture succeeded and the order's commit did not. */
const taken = (overrides: Record<string, unknown> = {}) =>
  held({
    status: "succeeded",
    amount_capturable: 0,
    amount_received: 1500,
    ...overrides,
  });

const settle = (
  options: Partial<Parameters<typeof settleWebsitePayment>[2]> = {},
) =>
  settleWebsitePayment(stripe, tx, {
    paymentIntentId: "pi_123",
    clientSecret: SECRET,
    cart: { totalInCents: 1500 },
    pickUpProblem: null,
    ...options,
  });

beforeEach(() => {
  for (const resource of Object.values(fake)) {
    for (const spy of Object.values(resource)) spy.mockReset();
  }
  findUnique.mockReset().mockResolvedValue(null);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("settleWebsitePayment", () => {
  describe("which payments it will look at", () => {
    it("reads the payment with its charge, to see what has been refunded", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(held());

      await settle();

      expect(fake.paymentIntents.retrieve).toHaveBeenCalledWith("pi_123", {
        expand: ["latest_charge"],
      });
    });

    it("gives one answer for a payment Stripe has never issued", async () => {
      fake.paymentIntents.retrieve.mockRejectedValue(
        new Stripe.errors.StripeInvalidRequestError({
          type: "invalid_request_error",
          code: "resource_missing",
          message: "No such payment_intent",
        }),
      );

      await expect(settle()).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("gives the same answer when the client secret is not this payment's", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(
        held({ client_secret: "pi_123_secret_other" }),
      );

      await expect(settle()).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(findUnique).not.toHaveBeenCalled();
    });

    it("and for a payment that is not the website's", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(
        held({ metadata: { purpose: "app_order", userId: "user-1" } }),
      );

      await expect(settle()).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(fake.paymentIntents.cancel).not.toHaveBeenCalled();
    });
  });

  describe("a payment on hold", () => {
    it("is captured when the hold is for exactly what the cart costs", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(held());

      expect(await settle()).toEqual({ capture: "pi_123" });
      // Capturing is the order's last step, not settlement's.
      expect(fake.paymentIntents.capture).not.toHaveBeenCalled();
      expect(fake.paymentIntents.cancel).not.toHaveBeenCalled();
    });

    it("is released when the cart now costs more than was held", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(held());

      expect(await settle({ cart: { totalInCents: 2300 } })).toEqual({
        refusal: { ok: false, reason: "cart-changed" },
      });
      expect(fake.paymentIntents.cancel).toHaveBeenCalledWith("pi_123", {
        cancellation_reason: "abandoned",
      });
    });

    it("is released when the cart now costs less - never captured at the amount held", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(held());

      expect(await settle({ cart: { totalInCents: 700 } })).toEqual({
        refusal: { ok: false, reason: "cart-changed" },
      });
      expect(fake.paymentIntents.cancel).toHaveBeenCalledOnce();
    });

    it("is released when it was held in another currency", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(held({ currency: "aud" }));

      expect(await settle()).toEqual({
        refusal: { ok: false, reason: "cart-changed" },
      });
      expect(fake.paymentIntents.cancel).toHaveBeenCalledOnce();
    });

    it("is released, with the soonest time instead, when the shop cannot take the pick-up time", async () => {
      const asap = new Date("2026-09-18T07:20:00Z");
      fake.paymentIntents.retrieve.mockResolvedValue(held());

      expect(await settle({ pickUpProblem: { asap } })).toEqual({
        refusal: { ok: false, reason: "pick-up-time", asap },
      });
      expect(fake.paymentIntents.cancel).toHaveBeenCalledOnce();
    });

    it("is released when something in the cart can no longer be sold", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(held());

      expect(
        await settle({
          cart: { problem: "One of your items has been removed" },
        }),
      ).toEqual({
        refusal: {
          ok: false,
          reason: "cart-invalid",
          message: "One of your items has been removed",
        },
      });
      expect(fake.paymentIntents.cancel).toHaveBeenCalledOnce();
    });
  });

  describe("a payment that is not on hold", () => {
    it("is refused as expired once its hold has been let go", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(
        held({ status: "canceled", amount_capturable: 0 }),
      );

      expect(await settle()).toEqual({
        refusal: { ok: false, reason: "expired" },
      });
    });

    it.each([
      "requires_payment_method",
      "requires_confirmation",
      "requires_action",
      "processing",
    ])(
      "is refused as not paid while it is %s - the order that places nothing unpaid",
      async (status) => {
        fake.paymentIntents.retrieve.mockResolvedValue(
          held({ status, amount_capturable: 0 }),
        );

        expect(await settle()).toEqual({
          refusal: { ok: false, reason: "not-paid" },
        });
        expect(fake.paymentIntents.cancel).not.toHaveBeenCalled();
        expect(fake.refunds.create).not.toHaveBeenCalled();
      },
    );
  });

  describe("a payment already taken - the capture succeeded and the order's commit did not", () => {
    it("places the order without capturing again when the cart still matches", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(taken());

      expect(await settle()).toEqual({ capture: null });
      expect(fake.refunds.create).not.toHaveBeenCalled();
    });

    it("places it even for a pick-up time that has since passed: the money is taken", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(taken());

      expect(await settle({ pickUpProblem: { asap: null } })).toEqual({
        capture: null,
      });
    });

    it("refunds it in full when the cart no longer matches", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(taken());

      expect(await settle({ cart: { totalInCents: 900 } })).toEqual({
        refusal: { ok: false, reason: "refunded", refundedInCents: 1500 },
      });
      // The order server's sweep refunds with these same parameters under this same key,
      // so however the two interleave the payment is refunded once.
      expect(fake.refunds.create).toHaveBeenCalledWith(
        { payment_intent: "pi_123" },
        { idempotencyKey: refundIdempotencyKey("pi_123") },
      );
    });

    it("refuses one that has been refunded, without refunding again", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(
        taken({ latest_charge: { id: "ch_123", amount_refunded: 1500 } }),
      );

      expect(await settle()).toEqual({
        refusal: { ok: false, reason: "refunded", refundedInCents: 1500 },
      });
      expect(fake.refunds.create).not.toHaveBeenCalled();
    });

    it("will not read a charge that was not expanded as nothing refunded", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(
        taken({ latest_charge: "ch_123" }),
      );

      await expect(settle()).rejects.toThrow("without its charge expanded");
    });
  });

  describe("a payment that already has its order", () => {
    it("hands back that order, whatever cart this call sends, and touches nothing", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(taken());
      findUnique.mockResolvedValue({ id: "order-1" });

      expect(await settle({ cart: { totalInCents: 1 } })).toEqual({
        orderId: "order-1",
      });
      expect(findUnique).toHaveBeenCalledWith({
        where: { paymentIntentId: "pi_123" },
        select: { id: true },
      });
      expect(fake.refunds.create).not.toHaveBeenCalled();
      expect(fake.paymentIntents.cancel).not.toHaveBeenCalled();
    });

    it("never lets go of the hold on an order that exists", async () => {
      fake.paymentIntents.retrieve.mockResolvedValue(held());
      findUnique.mockResolvedValue({ id: "order-1" });

      expect(await settle({ cart: { totalInCents: 1 } })).toEqual({
        orderId: "order-1",
      });
      expect(fake.paymentIntents.cancel).not.toHaveBeenCalled();
    });
  });

  it("keys the capture the way the order server's sweep does", () => {
    expect(captureIdempotencyKey("pi_123")).toBe("order-capture:pi_123");
    expect(refundIdempotencyKey("pi_123")).toBe("order-refund:pi_123");
  });
});
