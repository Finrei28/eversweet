import { formatCurrency } from "~/lib/formatters";

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
  /** A combo's price for its whole set. Absent where only the first two apply. */
  comboPriceInCents?: number | null;
};

export const DISCOUNT_MIN_PERCENT = 1;
export const DISCOUNT_MAX_PERCENT = 100;

/**
 * Rule 1, as one expression, so the schema and the constraint cannot disagree. Exactly one
 * of three since combo offers (20261125000000_offer_combos): a fixed price, a percentage, or
 * a combo's price for its set - the constraint is `NUM_NONNULLS(...) = 1`.
 */
export const hasExactlyOnePrice = (offer: OfferPricing): boolean =>
  [offer.itemPriceInCents, offer.discountAmount, offer.comboPriceInCents ?? null].filter(
    (price) => price !== null,
  ).length === 1;

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

/** One slot of a combo, as the form and the router hold it: a dessert or a whole category. */
export type ComboSlotTarget = { dessertId: string | null; categoryId: string | null };

type CeilingDessert = {
  id: string;
  name: string;
  priceInCents: number;
  categoryId: string;
};

export type ComboCeiling = {
  totalCents: number;
  parts: { label: string; cents: number; fromCategory: boolean }[];
};

/**
 * Rule 3 for a combo: the most its set may cost is under the cheapest dessert each slot can
 * take, added up - "any mochi + any sago" has to beat the cheapest mochi and the cheapest sago
 * bought on their own. A category named twice counts twice. Null while a slot names nothing
 * on the menu, which has no ceiling to break, as for a single offer.
 *
 * The parts are kept so the admin is told the sum, not just a number: "Mochi Series from
 * $9.50 + Sago Series from $8.00 = $17.50".
 */
export const comboCeiling = (
  slots: readonly ComboSlotTarget[],
  desserts: readonly CeilingDessert[],
  categoryName: (categoryId: string) => string,
): ComboCeiling | null => {
  if (slots.length === 0) return null;
  const parts: ComboCeiling["parts"] = [];
  for (const slot of slots) {
    if (slot.dessertId !== null) {
      const dessert = desserts.find((d) => d.id === slot.dessertId);
      if (!dessert) return null;
      parts.push({ label: dessert.name, cents: dessert.priceInCents, fromCategory: false });
      continue;
    }
    const cheapest = cheapestDessert(
      desserts.filter((d) => d.categoryId === slot.categoryId),
    );
    if (!cheapest || slot.categoryId === null) return null;
    parts.push({
      label: categoryName(slot.categoryId),
      cents: cheapest.priceInCents,
      fromCategory: true,
    });
  }
  return {
    totalCents: parts.reduce((sum, part) => sum + part.cents, 0),
    parts,
  };
};

/** "Mochi Series from $9.50 + Sago Series from $8.00 = $17.50". */
export const describeComboCeiling = (ceiling: ComboCeiling) =>
  `${ceiling.parts
    .map(
      (part) =>
        `${part.label} ${part.fromCategory ? "from " : ""}${formatCurrency(part.cents / 100)}`,
    )
    .join(" + ")} = ${formatCurrency(ceiling.totalCents / 100)}`;
