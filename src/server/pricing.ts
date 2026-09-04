import "server-only";

import type { PrismaClient } from "@prisma/client";

/**
 * The single source of truth for what a cart costs.
 *
 * Prices must never be taken from the browser. Everything here is derived from
 * the database so that the amount we charge, the amount we record against the
 * order, and the amount we show on the menu cannot disagree with each other or
 * be influenced by the client.
 */

export type PromoLike = {
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

/**
 * A promo applies only while it is switched on AND inside its date window.
 *
 * A null `startsAt` means "no start bound" and a null `endsAt` means "runs
 * until switched off", which is how the admin UI leaves them when a promo is
 * open-ended.
 */
export const isPromoActive = (
  promo: PromoLike | null | undefined,
  now: Date = new Date(),
): boolean =>
  !!promo &&
  promo.isActive &&
  (promo.startsAt === null || promo.startsAt <= now) &&
  (promo.endsAt === null || promo.endsAt >= now);

/**
 * Discount for a single unit, in cents. Returns 0 for a promo that is not
 * currently running, so callers can apply this unconditionally.
 *
 * A FIXED_AMOUNT promo is clamped to the item price: a $5 discount on a $3
 * dessert is a free dessert, never a negative line that eats into the rest of
 * the order.
 */
export const promoDiscountInCents = (
  priceInCents: number,
  promo: PromoLike | null | undefined,
  now: Date = new Date(),
): number => {
  if (!isPromoActive(promo, now)) return 0;

  return promo!.type === "FIXED_AMOUNT"
    ? Math.min(promo!.value, priceInCents)
    : Math.floor(priceInCents * (promo!.value / 100));
};

/** Strips a promo that is not currently running, so clients never see it. */
export const activePromoOnly = <T extends { promo: PromoLike | null }>(
  item: T,
  now: Date = new Date(),
): T => (isPromoActive(item.promo, now) ? item : { ...item, promo: null });

export class CartPricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CartPricingError";
  }
}

export type CartLineInput = {
  dessertId: string;
  quantity: number;
  customisations: { id: string; quantity: number }[];
};

export type PricedCartLine = {
  dessertId: string;
  quantity: number;
  /** Undiscounted unit price of the dessert itself. */
  unitPriceInCents: number;
  /** Promo discount for one unit, already gated on the promo being live. */
  discountedAmountInCents: number;
  promoId: string | null;
  /** (unit - discount + customisations) * quantity */
  lineTotalInCents: number;
};

/**
 * Prices a cart against current database state.
 *
 * Throws CartPricingError if an item has been deleted or is no longer for
 * sale, so a stale cart can never be charged for something we will not make.
 */
export const priceCart = async (
  db: PrismaClient,
  lines: CartLineInput[],
  {
    now = new Date(),
    /**
     * Reject items that are no longer for sale. True before taking payment.
     *
     * False once payment has succeeded: an item selling out in the seconds
     * between the charge and the order being written must not stop us
     * recording an order the customer has already paid for.
     */
    requireAvailable = true,
  }: { now?: Date; requireAvailable?: boolean } = {},
): Promise<{ lines: PricedCartLine[]; totalInCents: number }> => {
  if (lines.length === 0) {
    throw new CartPricingError("Your cart is empty.");
  }

  const dessertIds = [...new Set(lines.map((l) => l.dessertId))];
  const customisationIds = [
    ...new Set(lines.flatMap((l) => l.customisations.map((c) => c.id))),
  ];

  const [desserts, customisations] = await Promise.all([
    db.dessert.findMany({
      where: { id: { in: dessertIds } },
      select: {
        id: true,
        name: true,
        priceInCents: true,
        isAvailableForPurchase: true,
        promoId: true,
        promo: true,
      },
    }),
    customisationIds.length
      ? db.ingredient.findMany({
          where: { id: { in: customisationIds } },
          select: {
            id: true,
            name: true,
            priceInCents: true,
            isAvailableForPurchase: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const dessertById = new Map(desserts.map((d) => [d.id, d]));
  const customisationById = new Map(customisations.map((c) => [c.id, c]));

  const unavailable: string[] = [];
  const missing: string[] = [];

  const pricedLines = lines.map((line) => {
    const dessert = dessertById.get(line.dessertId);
    if (!dessert) {
      missing.push(line.dessertId);
      return null;
    }
    if (!dessert.isAvailableForPurchase) unavailable.push(dessert.name);

    const discountedAmountInCents = promoDiscountInCents(
      dessert.priceInCents,
      dessert.promo,
      now,
    );

    let customisationsInCents = 0;
    for (const chosen of line.customisations) {
      const customisation = customisationById.get(chosen.id);
      if (!customisation) {
        missing.push(chosen.id);
        continue;
      }
      if (!customisation.isAvailableForPurchase) {
        unavailable.push(customisation.name);
      }
      customisationsInCents += customisation.priceInCents * chosen.quantity;
    }

    return {
      dessertId: dessert.id,
      quantity: line.quantity,
      unitPriceInCents: dessert.priceInCents,
      discountedAmountInCents,
      // Only record the promo when it actually moved the price, so an order
      // never points at a promo it did not receive.
      promoId: discountedAmountInCents > 0 ? dessert.promoId : null,
      lineTotalInCents:
        (dessert.priceInCents -
          discountedAmountInCents +
          customisationsInCents) *
        line.quantity,
    };
  });

  if (missing.length > 0) {
    throw new CartPricingError(
      "One of your items has been removed or updated. Please empty your cart and add your items again from the menu. If this keeps happening, contact eversweet@eversweet.co.nz",
    );
  }
  if (requireAvailable && unavailable.length > 0) {
    throw new CartPricingError(
      `The following items are unavailable or have sold out: ${[...new Set(unavailable)].join(", ")}. Please check your cart and update your selections.`,
    );
  }

  const finalLines = pricedLines.filter((l): l is PricedCartLine => l !== null);

  return {
    lines: finalLines,
    totalInCents: finalLines.reduce((sum, l) => sum + l.lineTotalInCents, 0),
  };
};

/**
 * GST component of a GST-inclusive total, in cents.
 *
 * NZ retail prices are displayed and charged inclusive of 15% GST, so the tax
 * already sits inside the total: it is total x 3/23, not total x 0.15. The
 * latter treats the total as GST-exclusive and overstates the tax by ~15%.
 */
export const gstInCentsFromInclusiveTotal = (totalInCents: number): number =>
  Math.round((totalInCents * 3) / 23);
