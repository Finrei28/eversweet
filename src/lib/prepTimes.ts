/**
 * How long each size of order takes to make, and the quote derived from it.
 *
 * The values live in one `PrepTimeSetting` row, shared with the order server —
 * the shop tunes them once and both the website and the kitchen follow. The
 * formula is repeated here rather than imported because the two run as
 * separate deployments with no shared package; the numbers, which are what
 * actually drift, come from the single row.
 */
export type PrepTimes = {
  singleItem: number;
  upToThree: number;
  upToSix: number;
  moreThanSix: number;
  kitchenSlack: number;
  quoteFloor: number;
};

/**
 * Used until the row loads, and if it cannot be read. These reproduce the
 * quotes the website offered when the numbers were hardcoded, so a slow or
 * failed query shows the customer the same times as before rather than nothing.
 */
export const DEFAULT_PREP_TIMES: PrepTimes = {
  singleItem: 5,
  upToThree: 10,
  upToSix: 15,
  moreThanSix: 20,
  kitchenSlack: 1,
  quoteFloor: 10,
};

/** Minutes to actually make an order of this size. */
export const prepMinutes = (
  itemCount: number,
  times: PrepTimes = DEFAULT_PREP_TIMES,
): number => {
  if (itemCount <= 1) return times.singleItem;
  if (itemCount <= 3) return times.upToThree;
  if (itemCount <= 6) return times.upToSix;
  return times.moreThanSix;
};

/**
 * The soonest slot a customer may be offered, in minutes from now.
 *
 * Never below `quoteFloor`, so a single dessert is still promised in ten
 * minutes even though the kitchen only needs five. The buffer absorbs a queue
 * or a busy till — under-promising costs little, and a customer arriving to an
 * unmade order costs a lot.
 */
export const quoteMinutes = (
  itemCount: number,
  times: PrepTimes = DEFAULT_PREP_TIMES,
): number => Math.max(prepMinutes(itemCount, times), times.quoteFloor);
