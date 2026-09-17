import "server-only";

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
 * Customers the website creates are marked with `source: "website"` and reused by email,
 * so a regular's orders gather under one customer. The order server creates customers of
 * its own for app accounts (marked with a `userId`, never a `source`), and those are never
 * reused from here: the website has no login, so anyone can type anyone's email at
 * checkout, and that must not reach an app account's cards or membership.
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

/** The Stripe calls made here - narrow, so a test can hand in a fake. */
export type StripeForCheckout = {
  customers: Pick<Stripe["customers"], "list" | "create" | "update">;
  paymentIntents: Pick<Stripe["paymentIntents"], "retrieve" | "update">;
};

/**
 * The website customer with this email, if there is one.
 *
 * `list` rather than `search`: search lags about a minute behind writes, so two orders in
 * quick succession would each have created a customer.
 */
export async function findWebsiteCustomer(
  stripe: StripeForCheckout,
  email: string,
): Promise<Stripe.Customer | null> {
  const { data } = await stripe.customers.list({ email, limit: 100 });
  return (
    data.find((customer) => customer.metadata?.source === WEBSITE_SOURCE) ??
    null
  );
}

/**
 * Brings the website customer found for these details up to date, or creates one when
 * there is none, and returns its id.
 */
export async function saveWebsiteCustomer(
  stripe: StripeForCheckout,
  existing: Stripe.Customer | null,
  details: WebsiteCustomerDetails,
): Promise<string> {
  if (!existing) {
    const created = await stripe.customers.create({
      ...details,
      metadata: { source: WEBSITE_SOURCE },
    });
    return created.id;
  }

  // The latest order's details win: a changed phone number is the newer one.
  if (existing.name !== details.name || existing.phone !== details.phone) {
    await stripe.customers.update(existing.id, {
      name: details.name,
      phone: details.phone,
    });
  }

  return existing.id;
}

/** Statuses in which a payment has not been confirmed, so its customer can still be set. */
const OPEN_STATUSES = new Set<Stripe.PaymentIntent.Status>([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
]);

export type AttachCheckoutCustomerResult =
  | { ok: true; customerId: string }
  | { ok: false; status: 404 | 409; error: string };

/**
 * Puts the checkout's customer on its payment, before the browser confirms it.
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

  // Only a website payment that has not been paid yet. An app payment's customer is the
  // order server's, and a confirmed payment's customer can no longer be changed.
  if (
    paymentIntent.metadata?.source !== WEBSITE_SOURCE ||
    !OPEN_STATUSES.has(paymentIntent.status)
  ) {
    return {
      ok: false,
      status: 409,
      error: "This payment can no longer be changed",
    };
  }

  const existing = await findWebsiteCustomer(stripe, details.email);
  const current =
    typeof paymentIntent.customer === "string"
      ? paymentIntent.customer
      : (paymentIntent.customer?.id ?? null);

  // Stripe will not move a payment to another customer once it has one ("You cannot modify
  // `customer` on a PaymentIntent once it already has been set"). That is reached by paying
  // again under a different email after a declined card, and the payment keeps the first
  // customer. Checked before saving, so the refusal does not leave a customer behind with
  // no payment to show for it.
  if (current && current !== existing?.id) {
    return {
      ok: false,
      status: 409,
      error: "This payment already has a customer",
    };
  }

  const customerId = await saveWebsiteCustomer(stripe, existing, details);

  if (!current) {
    await stripe.paymentIntents.update(paymentIntent.id, {
      customer: customerId,
    });
  }

  return { ok: true, customerId };
}
