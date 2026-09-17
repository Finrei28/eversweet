import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  attachCheckoutCustomer,
  checkoutCustomerSchema,
  findWebsiteCustomer,
  saveWebsiteCustomer,
  type StripeForCheckout,
  type WebsiteCustomerDetails,
} from "./stripeCustomer";

const fake = {
  customers: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
  paymentIntents: { retrieve: vi.fn(), update: vi.fn() },
};
const stripe = fake as unknown as StripeForCheckout;

const ADA: WebsiteCustomerDetails = {
  name: "Ada Lovelace",
  email: "ada@example.test",
  phone: "+64211234567",
};

const SECRET = "pi_123_secret_abc";

/** A payment intent as `/api/checkout_sessions` creates it. */
const websitePayment = (overrides: Partial<Stripe.PaymentIntent> = {}) => ({
  id: "pi_123",
  client_secret: SECRET,
  status: "requires_payment_method",
  metadata: { source: "website" },
  customer: null,
  ...overrides,
});

beforeEach(() => {
  for (const resource of Object.values(fake)) {
    for (const spy of Object.values(resource)) spy.mockReset();
  }
  fake.customers.list.mockResolvedValue({ data: [] });
  fake.customers.create.mockResolvedValue({ id: "cus_new" });
});

describe("checkoutCustomerSchema", () => {
  it("normalises the checkout form's details into a Stripe customer's", () => {
    expect(
      checkoutCustomerSchema.parse({
        firstName: " Ada ",
        lastName: "Lovelace ",
        email: " Ada@Example.TEST ",
        phone: "021 123 4567",
      }),
    ).toEqual(ADA);
  });

  it.each([
    ["a blank first name", { firstName: "  " }],
    ["an email with no domain", { email: "ada@" }],
    ["a phone number that is not one", { phone: "12" }],
  ])("refuses %s", (_, overrides) => {
    const result = checkoutCustomerSchema.safeParse({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.test",
      phone: "+64211234567",
      ...overrides,
    });

    expect(result.success).toBe(false);
  });
});

describe("findWebsiteCustomer and saveWebsiteCustomer", () => {
  const findOrCreateWebsiteCustomer = async (
    stripe: StripeForCheckout,
    details: WebsiteCustomerDetails,
  ) =>
    saveWebsiteCustomer(
      stripe,
      await findWebsiteCustomer(stripe, details.email),
      details,
    );

  it("creates a website customer with top-level details when there is none", async () => {
    const id = await findOrCreateWebsiteCustomer(stripe, ADA);

    expect(id).toBe("cus_new");
    expect(fake.customers.list).toHaveBeenCalledWith({
      email: "ada@example.test",
      limit: 100,
    });
    expect(fake.customers.create).toHaveBeenCalledWith({
      ...ADA,
      metadata: { source: "website" },
    });
  });

  it("reuses the website customer with that email, unchanged", async () => {
    fake.customers.list.mockResolvedValue({
      data: [{ id: "cus_web", ...ADA, metadata: { source: "website" } }],
    });

    expect(await findOrCreateWebsiteCustomer(stripe, ADA)).toBe("cus_web");
    expect(fake.customers.create).not.toHaveBeenCalled();
    expect(fake.customers.update).not.toHaveBeenCalled();
  });

  it("brings a reused customer's name and phone up to date", async () => {
    fake.customers.list.mockResolvedValue({
      data: [
        {
          id: "cus_web",
          ...ADA,
          phone: "+64220000000",
          metadata: { source: "website" },
        },
      ],
    });

    await findOrCreateWebsiteCustomer(stripe, ADA);

    expect(fake.customers.update).toHaveBeenCalledWith("cus_web", {
      name: ADA.name,
      phone: ADA.phone,
    });
  });

  /**
   * Anyone can type anyone's email at checkout. An app account's customer holds its cards
   * and membership, so the website neither pays against it nor rewrites it.
   */
  it("never reuses or changes an app account's customer with the same email", async () => {
    fake.customers.list.mockResolvedValue({
      data: [
        {
          id: "cus_app",
          name: "Someone Else",
          email: ADA.email,
          metadata: { userId: "user_1" },
        },
      ],
    });

    expect(await findOrCreateWebsiteCustomer(stripe, ADA)).toBe("cus_new");
    expect(fake.customers.update).not.toHaveBeenCalled();
  });
});

describe("attachCheckoutCustomer", () => {
  it("attaches the customer to a website payment that has not been paid", async () => {
    fake.paymentIntents.retrieve.mockResolvedValue(websitePayment());

    const result = await attachCheckoutCustomer(stripe, SECRET, ADA);

    expect(result).toEqual({ ok: true, customerId: "cus_new" });
    expect(fake.paymentIntents.retrieve).toHaveBeenCalledWith("pi_123");
    expect(fake.paymentIntents.update).toHaveBeenCalledWith("pi_123", {
      customer: "cus_new",
    });
  });

  it("leaves a payment alone that already has this customer", async () => {
    fake.customers.list.mockResolvedValue({
      data: [{ id: "cus_web", ...ADA, metadata: { source: "website" } }],
    });
    fake.paymentIntents.retrieve.mockResolvedValue(
      websitePayment({ customer: "cus_web" }),
    );

    expect(await attachCheckoutCustomer(stripe, SECRET, ADA)).toEqual({
      ok: true,
      customerId: "cus_web",
    });
    expect(fake.customers.create).not.toHaveBeenCalled();
    expect(fake.paymentIntents.update).not.toHaveBeenCalled();
  });

  /**
   * Paying again under a different email after a declined card. Stripe refuses to change a
   * payment's customer once set, so this used to create a customer it could not attach.
   */
  it("refuses to move a payment to another customer, and creates none", async () => {
    fake.paymentIntents.retrieve.mockResolvedValue(
      websitePayment({ customer: "cus_first_email" }),
    );

    expect(await attachCheckoutCustomer(stripe, SECRET, ADA)).toMatchObject({
      ok: false,
      status: 409,
    });
    expect(fake.customers.create).not.toHaveBeenCalled();
    expect(fake.customers.update).not.toHaveBeenCalled();
    expect(fake.paymentIntents.update).not.toHaveBeenCalled();
  });

  it.each([
    ["the payment's id alone", "pi_123"],
    ["another payment's secret", "pi_123_secret_wrong"],
  ])("answers %s with a 404", async (_, clientSecret) => {
    fake.paymentIntents.retrieve.mockResolvedValue(websitePayment());

    expect(
      await attachCheckoutCustomer(stripe, clientSecret, ADA),
    ).toMatchObject({ ok: false, status: 404 });
    expect(fake.customers.create).not.toHaveBeenCalled();
  });

  it("answers a payment Stripe has never heard of with a 404", async () => {
    fake.paymentIntents.retrieve.mockRejectedValue(
      new Stripe.errors.StripeInvalidRequestError({
        type: "invalid_request_error",
        code: "resource_missing",
        message: "No such payment_intent",
      }),
    );

    expect(await attachCheckoutCustomer(stripe, SECRET, ADA)).toMatchObject({
      ok: false,
      status: 404,
    });
  });

  it.each([
    ["an app payment", websitePayment({ metadata: { purpose: "app_order" } })],
    ["a payment already made", websitePayment({ status: "succeeded" })],
  ])("refuses %s without creating a customer", async (_, paymentIntent) => {
    fake.paymentIntents.retrieve.mockResolvedValue(paymentIntent);

    expect(await attachCheckoutCustomer(stripe, SECRET, ADA)).toMatchObject({
      ok: false,
      status: 409,
    });
    expect(fake.customers.create).not.toHaveBeenCalled();
    expect(fake.paymentIntents.update).not.toHaveBeenCalled();
  });
});
