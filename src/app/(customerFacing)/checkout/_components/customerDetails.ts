import parsePhoneNumberFromString from "libphonenumber-js";

import type { CustomerInfo } from "~/lib/types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Whether the customer's details are enough to start a payment: both names, an email
 * with a domain, and a phone number valid in New Zealand.
 *
 * The checkout starts the payment once this holds, and until it does the payment
 * section asks for the details rather than showing a spinner. The order itself is still
 * parsed with `createOrderSchema` before the card is touched (see `checkoutForm.tsx`).
 */
export function detailsComplete(info: CustomerInfo): boolean {
  const phone = parsePhoneNumberFromString(info.phone, "NZ");
  return (
    !!info.customerFirstName?.trim() &&
    !!info.customerLastName?.trim() &&
    !!info.customerEmail?.trim() &&
    EMAIL.test(info.customerEmail.trim()) &&
    !!phone?.isValid()
  );
}
