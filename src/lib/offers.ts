import { isWithinActiveWindow, type ActiveWindow } from "~/lib/activeWindow";

/**
 * What the admin needs to know about an offer's availability, without the rest of it.
 *
 * Offers are authored here and served by the order server, so nothing in this repo
 * prices against them - these helpers exist for the admin table's status badge and for
 * the guard on the activate mutation.
 */
export type OfferWindow = ActiveWindow & { archivedAt: Date | null };

export type OfferState = "ARCHIVED" | "PAUSED" | "SCHEDULED" | "ENDED" | "LIVE";

/**
 * Has this offer's run finished?
 *
 * The single predicate the whole run lifecycle turns on. Deliberately independent of
 * `isActive`: keying off the ENDED *badge* instead would leave two holes, because an
 * offer that is paused **and** past its end date would read PAUSED. It could then be
 * edited back into its window and reactivated without its run ever being closed, and
 * there would be no way to close it either.
 *
 * Inclusive at the boundary, matching isWithinActiveWindow: an offer is still running at
 * the exact instant it ends.
 */
export const hasEnded = (
  offer: Pick<OfferWindow, "endsAt">,
  now: Date = new Date(),
): boolean => offer.endsAt !== null && offer.endsAt < now;

/**
 * One label for the badge.
 *
 * The order matters. Archived beats everything - an offer that is archived *and* switched
 * on reads as archived, because archiving clears isActive and a stale flag underneath
 * should not be what the admin sees.
 *
 * ENDED then beats PAUSED, so the badge means exactly `hasEnded`: the same condition that
 * blocks editing and enables Close run. One concept, one badge. Ordering it the other way
 * would hide a finished run behind a PAUSED label.
 */
export const offerState = (
  offer: OfferWindow,
  now: Date = new Date(),
): OfferState => {
  if (offer.archivedAt !== null) return "ARCHIVED";
  if (hasEnded(offer, now)) return "ENDED";
  if (!offer.isActive) return "PAUSED";
  if (offer.startsAt !== null && offer.startsAt > now) return "SCHEDULED";
  return "LIVE";
};

/**
 * Can this offer be switched on and actually run?
 *
 * A past `endsAt` would leave it flagged active and still dead, which reads as a bug from
 * behind the counter. The activate mutation refuses instead of silently doing nothing,
 * and the row menu greys the action out for the same reason.
 *
 * Exactly the negation of `hasEnded`, expressed that way so the two cannot drift - it is
 * the same question asked from the other side. A future `startsAt` is fine: that is a
 * scheduled offer, not a broken one.
 */
export const canActivate = (
  offer: Pick<OfferWindow, "endsAt">,
  now: Date = new Date(),
): boolean => !hasEnded(offer, now);

/** Live right now: switched on, not archived, inside its window. */
export const isOfferRunning = (
  offer: OfferWindow,
  now: Date = new Date(),
): boolean => offer.archivedAt === null && isWithinActiveWindow(offer, now);
