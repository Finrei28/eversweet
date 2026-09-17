import "server-only";

import { createHash } from "node:crypto";

import parsePhoneNumberFromString from "libphonenumber-js";
import Stripe from "stripe";
import { z } from "zod";

/**
 * Who paid for a website order, as the Stripe Dashboard shows it.
 *
 * A payment shows a name and email under "Customer" only when it belongs to a Stripe
 * customer, and website payments used to belong to none - the details typed at checkout
 * went into the `Order` row and nowhere else.
 *
 * The website has no login, so nothing here can prove that whoever types an email owns it.
 * Three rules follow from that:
 *
 * - **A customer is attached only once the payment has succeeded.** Stripe accepts a
 *   customer on a paid payment intent that has none. Attaching before confirmation let
 *   anyone mint customers for payments they then abandoned.
 * - **A customer is reused only when the email, name and phone all match, and is never
 *   edited.** Reusing by email alone and updating the rest let anyone who knew a regular's
 *   email rewrite that customer's name and phone, and put their own payment under them.
 *   A regular who types the same details every time still gathers under one customer; one
 *   who changes their phone number starts a second.
 * - **Only customers the website created (`source: "website"`) are candidates.** The order
 *   server's customers belong to app accounts (marked with a `userId`, never a `source`) and
 *   hold their cards and membership.
 */

/** Marks a Stripe object as the website's, on both the customer and the payment intent. */
export const WEBSITE_SOURCE = "website";

/** The same check the checkout form makes, so an address it accepts is accepted here. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The checkout form's details, in the shape a Stripe customer stores them.
 *
 * The email is lowercased because Stripe's email filter is an exact, case-sensitive match:
 * "Ada@example.com" would otherwise miss the customer "ada@example.com" was given.
 */
export const checkoutCustomerSchema = z
  .object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    email: z.string().trim().toLowerCase().regex(EMAIL_PATTERN),
    phone: z.string(),
  })
  .transform((customer, ctx) => {
    const phone = parsePhoneNumberFromString(customer.phone, "NZ");
    if (!phone?.isValid()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "A valid New Zealand phone number is required",
      });
      return z.NEVER;
    }

    return {
      name: `${customer.firstName} ${customer.lastName}`,
      email: customer.email,
      phone: phone.number,
    };
  });

export type WebsiteCustomerDetails = z.output<typeof checkoutCustomerSchema>;

/**
 * The Stripe calls made here - narrow, so a test can hand in a fake. There is deliberately
 * no `customers.update`: nothing the website is sent may change a customer that exists.
 */
export type StripeForCheckout = {
  customers: Pick<Stripe["customers"], "list" | "create">;
  paymentIntents: Pick<Stripe["paymentIntents"], "retrieve" | "update">;
};

/**
 * The website customer with exactly these details, if there is one.
 *
 * `list` rather than `search`: search lags about a minute behind writes, so two orders in
 * quick succession would each have created a customer.
 */
export async function findWebsiteCustomer(
  stripe: StripeForCheckout,
  details: WebsiteCustomerDetails,
): Promise<Stripe.Customer | null> {
  const { data } = await stripe.customers.list({
    email: details.email,
    limit: 100,
  });
  return (
    data.find(
      (customer) =>
        customer.metadata?.source === WEBSITE_SOURCE &&
        customer.name === details.name &&
        customer.phone === details.phone,
    ) ?? null
  );
}

/**
 * Stripe's idempotency key for creating the customer with these details.
 *
 * The list above cannot see a customer another request is creating at the same moment, so
 * two first orders placed together would each have created one. With the same key, Stripe
 * hands the second request the customer the first created. Keys last 24 hours, and by then
 * the list finds the customer. Hashed, so the details themselves are not the key.
 */
export const customerIdempotencyKey = (details: WebsiteCustomerDetails) =>
  `website-customer-${createHash("sha256")
    .update(JSON.stringify([details.email, details.name, details.phone]))
    .digest("hex")}`;

/** The website customer with exactly these details, created on first use. */
export async function findOrCreateWebsiteCustomer(
  stripe: StripeForCheckout,
  details: WebsiteCustomerDetails,
): Promise<string> {
  const existing = await findWebsiteCustomer(stripe, details);
  if (existing) return existing.id;

  const created = await stripe.customers.create(
    { ...details, metadata: { source: WEBSITE_SOURCE } },
    { idempotencyKey: customerIdempotencyKey(details) },
  );
  return created.id;
}

export type AttachCheckoutCustomerResult =
  | { ok: true; customerId: string }
  | { ok: false; status: 404 | 409; error: string };

/**
 * Puts the checkout's customer on its payment, once the payment has succeeded.
 *
 * Proof of ownership is the client secret rather than the payment intent id. The id alone
 * is not a secret - it is sent back to look an order up - while the client secret is what
 * the browser needed to pay at all.
 */
export async function attachCheckoutCustomer(
  stripe: StripeForCheckout,
  clientSecret: string,
  details: WebsiteCustomerDetails,
): Promise<AttachCheckoutCustomerResult> {
  const paymentIntentId = /^(pi_[A-Za-z0-9]+)_secret_[A-Za-z0-9]+$/.exec(
    clientSecret,
  )?.[1];

  let paymentIntent: Stripe.PaymentIntent | null = null;
  if (paymentIntentId) {
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      if (
        !(error instanceof Stripe.errors.StripeInvalidRequestError) ||
        error.code !== "resource_missing"
      ) {
        throw error;
      }
    }
  }

  if (!paymentIntent || paymentIntent.client_secret !== clientSecret) {
    return { ok: false, status: 404, error: "Payment not found" };
  }

  // Only a website payment, and only once it is paid: every customer created here stands
  // for money actually taken. An app payment's customer is the order server's.
  if (
    paymentIntent.metadata?.source !== WEBSITE_SOURCE ||
    paymentIntent.status !== "succeeded"
  ) {
    return {
      ok: false,
      status: 409,
      error: "This payment is not a completed website payment",
    };
  }

  const current =
    typeof paymentIntent.customer === "string"
      ? paymentIntent.customer
      : (paymentIntent.customer?.id ?? null);

  // Stripe will not move a payment to another customer once it has one ("You cannot modify
  // `customer` on a PaymentIntent once it already has been set"), so a payment keeps the
  // first customer it was given. A repeat of the same call finds that customer and is done;
  // anything else is refused before a customer is created that could not be attached.
  if (current) {
    const existing = await findWebsiteCustomer(stripe, details);
    return existing?.id === current
      ? { ok: true, customerId: current }
      : {
          ok: false,
          status: 409,
          error: "This payment already has a customer",
        };
  }

  const customerId = await findOrCreateWebsiteCustomer(stripe, details);

  await stripe.paymentIntents.update(paymentIntent.id, {
    customer: customerId,
  });

  return { ok: true, customerId };
}
