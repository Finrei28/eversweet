import { describe, expect, it } from "vitest";

import { detailsComplete } from "./customerDetails";

/**
 * Whether the checkout has what it needs to start a payment. The page used to test this
 * only inside the effect that creates the payment, so the payment section could not tell
 * "waiting for your details" from "starting your payment" and showed a spinner for both.
 */
describe("detailsComplete", () => {
  // As react-phone-input-2 hands the number over: digits, with the country code and no "+".
  const sam = {
    customerFirstName: "Sam",
    customerLastName: "Lee",
    customerEmail: "sam@example.com",
    phone: "64212345678",
  };

  it("accepts a customer with every detail", () => {
    expect(detailsComplete(sam)).toBe(true);
  });

  it("needs each name, ignoring spaces", () => {
    expect(detailsComplete({ ...sam, customerFirstName: "  " })).toBe(false);
    expect(detailsComplete({ ...sam, customerLastName: "" })).toBe(false);
  });

  it("needs an email with a domain", () => {
    expect(detailsComplete({ ...sam, customerEmail: "" })).toBe(false);
    expect(detailsComplete({ ...sam, customerEmail: "sam@example" })).toBe(
      false,
    );
    expect(
      detailsComplete({ ...sam, customerEmail: " sam@example.com " }),
    ).toBe(true);
  });

  it("needs a phone number New Zealand would dial", () => {
    // What the field holds before anything is typed: the country code alone.
    expect(detailsComplete({ ...sam, phone: "64" })).toBe(false);
    expect(detailsComplete({ ...sam, phone: "6421" })).toBe(false);
    expect(detailsComplete({ ...sam, phone: "+64 9 555 0123" })).toBe(true);
  });
});
