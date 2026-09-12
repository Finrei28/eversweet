/**
 * "Is this thing switched on, and is now inside its dates?"
 *
 * Promo and Offer both carry isActive + startsAt + endsAt and both mean the same thing
 * by them. The predicate started out inside `isPromoActive`; it lives here so that
 * offers cannot drift into a second, subtly different answer.
 *
 * Deliberately not `server-only`: the admin offers table renders the same verdict as a
 * status badge.
 */

export type ActiveWindow = {
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

/**
 * Both bounds are inclusive: a thing is live at the instant it starts and at the instant
 * it ends.
 *
 * A null `startsAt` means "no start bound" and a null `endsAt` means "runs until
 * switched off", which is how the admin leaves them when something is open-ended.
 */
export const isWithinActiveWindow = (
  window: ActiveWindow | null | undefined,
  now: Date = new Date(),
): boolean =>
  !!window &&
  window.isActive &&
  (window.startsAt === null || window.startsAt <= now) &&
  (window.endsAt === null || window.endsAt >= now);
