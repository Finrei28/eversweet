/**
 * What an offer is allowed to charge.
 *
 * Three rules, and they are split across three layers because no single one can hold all
 * of them:
 *
 * 1. **Exactly one of `itemPriceInCents` and `discountAmount`** — never both, never
 *    neither. Both set meant the discount was silently ignored by the order server;
 *    neither set meant an offer that advertises something and discounts nothing.
 * 2. **`discountAmount` is 1-100.** Zero is not a discount, and above 100 would pay the
 *    customer to order.
 * 3. **A fixed price must come in *under* the list price** of what it covers. Equal is
 *    not an offer, and above it is a surcharge.
 *
 * Rules 1 and 2 look at one row, so they are enforced by CHECK constraints as well as
 * here. Rule 3 compares against `Dessert.priceInCents` in another table, which a CHECK
 * constraint cannot reach (no subqueries), so it lives in the router and in the dialog.
 *
 * A fixed price of **0 is legal and means free** — "Free weekly mochi dessert bowl" and
 * "Buy 4 Mochi Bowls and get one for free" are both stored that way, and the order
 * server's `offerUnitPriceInCents` null-checks rather than truth-checks for exactly that
 * reason. Rule 3 still holds for them: 0 is under every list price.
 */

export type OfferPricing = {
  itemPriceInCents: number | null;
  discountAmount: number | null;
};

export const DISCOUNT_MIN_PERCENT = 1;
export const DISCOUNT_MAX_PERCENT = 100;

/** Rule 1, as one expression, so the schema and the constraint cannot disagree. */
export const hasExactlyOnePrice = (offer: OfferPricing): boolean =>
  (offer.itemPriceInCents === null) !== (offer.discountAmount === null);

/**
 * The item a fixed offer price has to beat.
 *
 * An offer scopes to a single dessert or to a whole category, and in production every
 * offer is category-scoped. A category holds items at different prices, so "the original
 * price" is the **cheapest** one: beating that is what makes the offer a discount on
 * every item it covers rather than only on the expensive ones.
 *
 * Returns the dessert rather than the number so the admin can be told which item set the
 * ceiling — "under $9.99" is a rule, "Mochi Bowl is $9.99" is an explanation.
 */
export const cheapestDessert = <T extends { priceInCents: number }>(
  desserts: readonly T[],
): T | null =>
  desserts.reduce<T | null>(
    (cheapest, dessert) =>
      cheapest === null || dessert.priceInCents < cheapest.priceInCents
        ? dessert
        : cheapest,
    null,
  );

/**
 * Rule 3. A null ceiling means there is nothing to compare against - the offer names no
 * dessert and no category, or names an empty category - and an unknowable rule is not a
 * broken one, so it passes.
 */
export const isUnderListPrice = (
  itemPriceInCents: number,
  ceilingInCents: number | null,
): boolean => ceilingInCents === null || itemPriceInCents < ceilingInCents;
