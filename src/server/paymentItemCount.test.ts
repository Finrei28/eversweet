import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// The real client throws on import without STRIPE_SECRET_KEY, which CI does not have.
const { retrieve } = vi.hoisted(() => ({ retrieve: vi.fn() }));
vi.mock("~/lib/stripe", () => ({ stripe: { paymentIntents: { retrieve } } }));

import { itemCountForPayment } from "./paymentItemCount";

beforeEach(() => {
  retrieve.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

/**
 * The pick-up time check gives the kitchen as long as the order's size needs. That size
 * used to be whatever the browser sent, so a page could have a large order checked as one
 * dessert, pay, and keep a time the kitchen could not meet.
 */
describe("itemCountForPayment", () => {
  it("reads the count /api/checkout_sessions recorded when it priced the cart", async () => {
    retrieve.mockResolvedValue({ metadata: { itemCount: "7" } });

    expect(await itemCountForPayment("pi_123")).toBe(7);
    expect(retrieve).toHaveBeenCalledWith("pi_123");
  });

  it.each([
    ["no count recorded", {}],
    ["a count that is not a number", { itemCount: "lots" }],
    ["a count of zero", { itemCount: "0" }],
    ["a fractional count", { itemCount: "1.5" }],
  ])("is null for a payment with %s", async (_, metadata) => {
    retrieve.mockResolvedValue({ metadata });

    expect(await itemCountForPayment("pi_123")).toBeNull();
  });

  it("is null for a payment Stripe has never heard of", async () => {
    retrieve.mockRejectedValue(
      new Stripe.errors.StripeInvalidRequestError({
        type: "invalid_request_error",
        code: "resource_missing",
        message: "No such payment_intent",
      }),
    );

    expect(await itemCountForPayment("pi_made_up")).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("is null, and says so, when Stripe cannot be reached", async () => {
    retrieve.mockRejectedValue(new Error("network down"));

    expect(await itemCountForPayment("pi_123")).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});
