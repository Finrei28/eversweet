import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  attachCheckoutCustomer,
  checkoutCustomerSchema,
  customerIdempotencyKey,
  findOrCreateWebsiteCustomer,
  type StripeForCheckout,
  type WebsiteCustomerDetails,
} from "./stripeCustomer";

const fake = {
  // `update` is a spy only so a test can prove nothing calls it.
  customers: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
  paymentIntents: { retrieve: vi.fn(), update: vi.fn() },
};
const stripe = fake as unknown as StripeForCheckout;

const ADA: WebsiteCustomerDetails = {
  name: "Ada Lovelace",
  email: "ada@example.test",
  phone: "+64211234567",
};

/** A customer the website created for ADA. */
const adasCustomer = { id: "cus_web", ...ADA, metadata: { source: "website" } };

const SECRET = "pi_123_secret_abc";

/** A payment intent as `/api/checkout_sessions` creates it, once the browser has paid. */
const websitePayment = (overrides: Partial<Stripe.PaymentIntent> = {}) => ({
  id: "pi_123",
  client_secret: SECRET,
  status: "succeeded",
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

describe("findOrCreateWebsiteCustomer", () => {
  it("creates a website customer with top-level details when there is none", async () => {
    const id = await findOrCreateWebsiteCustomer(stripe, ADA);

    expect(id).toBe("cus_new");
    expect(fake.customers.list).toHaveBeenCalledWith({
      email: "ada@example.test",
      limit: 100,
    });
    expect(fake.customers.create).toHaveBeenCalledWith(
      { ...ADA, metadata: { source: "website" } },
      { idempotencyKey: customerIdempotencyKey(ADA) },
    );
  });

  it("reuses the website customer whose email, name and phone all match", async () => {
    fake.customers.list.mockResolvedValue({ data: [adasCustomer] });

    expect(await findOrCreateWebsiteCustomer(stripe, ADA)).toBe("cus_web");
    expect(fake.customers.create).not.toHaveBeenCalled();
  });

  /**
   * Anyone can type anyone's email at checkout. Matching on the email alone, and updating
   * the rest, let a stranger who knew a regular's email rewrite that customer's name and
   * phone and put their own payment under them.
   */
  it.each([
    ["a different name", { name: "Someone Else" }],
    ["a different phone", { phone: "+64229876543" }],
  ])(
    "leaves a customer with the same email but %s untouched, and creates another",
    async (_, differs) => {
      fake.customers.list.mockResolvedValue({ data: [adasCustomer] });

      const id = await findOrCreateWebsiteCustomer(stripe, {
        ...ADA,
        ...differs,
      });

      expect(id).toBe("cus_new");
      expect(fake.customers.update).not.toHaveBeenCalled();
    },
  );

  it("never reuses an app account's customer with the same details", async () => {
    fake.customers.list.mockResolvedValue({
      data: [
        { ...adasCustomer, id: "cus_app", metadata: { userId: "user_1" } },
      ],
    });

    expect(await findOrCreateWebsiteCustomer(stripe, ADA)).toBe("cus_new");
    expect(fake.customers.update).not.toHaveBeenCalled();
  });
});

/**
 * Two first orders with the same details placed together both miss in the list. Stripe
 * returns the first request's customer to any repeat of its idempotency key, so the key
 * is what keeps them from becoming two customers.
 */
describe("customerIdempotencyKey", () => {
  it("is the same for the same details", () => {
    expect(customerIdempotencyKey({ ...ADA })).toBe(
      customerIdempotencyKey(ADA),
    );
  });

  it.each([
    ["email", { email: "ada2@example.test" }],
    ["name", { name: "Ada King" }],
    ["phone", { phone: "+64229876543" }],
  ])("differs when the %s does", (_, differs) => {
    expect(customerIdempotencyKey({ ...ADA, ...differs })).not.toBe(
      customerIdempotencyKey(ADA),
    );
  });

  it("does not carry the details themselves", () => {
    const key = customerIdempotencyKey(ADA);

    expect(key).toMatch(/^website-customer-[0-9a-f]{64}$/);
    expect(key).not.toContain("ada");
  });
});

describe("attachCheckoutCustomer", () => {
  it("attaches the customer to a website payment that has succeeded", async () => {
    fake.paymentIntents.retrieve.mockResolvedValue(websitePayment());

    const result = await attachCheckoutCustomer(stripe, SECRET, ADA);

    expect(result).toEqual({ ok: true, customerId: "cus_new" });
    expect(fake.paymentIntents.retrieve).toHaveBeenCalledWith("pi_123");
    expect(fake.paymentIntents.update).toHaveBeenCalledWith("pi_123", {
      customer: "cus_new",
    });
  });

  /**
   * Attaching before confirmation let anyone with a fresh client secret mint a customer and
   * abandon the payment. A customer now stands for money actually taken.
   */
  it.each([
    ["requires_payment_method"],
    ["requires_confirmation"],
    ["requires_action"],
    ["processing"],
    ["canceled"],
  ] as const)(
    "creates no customer for a payment that is %s",
    async (status) => {
      fake.paymentIntents.retrieve.mockResolvedValue(
        websitePayment({ status }),
      );

      expect(await attachCheckoutCustomer(stripe, SECRET, ADA)).toMatchObject({
        ok: false,
        status: 409,
      });
      expect(fake.customers.list).not.toHaveBeenCalled();
      expect(fake.customers.create).not.toHaveBeenCalled();
      expect(fake.paymentIntents.update).not.toHaveBeenCalled();
    },
  );

  it("refuses an app payment without creating a customer", async () => {
    fake.paymentIntents.retrieve.mockResolvedValue(
      websitePayment({ metadata: { purpose: "app_order" } }),
    );

    expect(await attachCheckoutCustomer(stripe, SECRET, ADA)).toMatchObject({
      ok: false,
      status: 409,
    });
    expect(fake.customers.create).not.toHaveBeenCalled();
  });

  it("answers a repeat for a payment that already has this customer", async () => {
    fake.customers.list.mockResolvedValue({ data: [adasCustomer] });
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

  // Stripe refuses to change a payment's customer once set.
  it("refuses to move a payment to another customer, and creates none", async () => {
    fake.paymentIntents.retrieve.mockResolvedValue(
      websitePayment({ customer: "cus_someone_else" }),
    );

    expect(await attachCheckoutCustomer(stripe, SECRET, ADA)).toMatchObject({
      ok: false,
      status: 409,
    });
    expect(fake.customers.create).not.toHaveBeenCalled();
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
});
