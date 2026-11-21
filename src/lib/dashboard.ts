import { endOfDayNZ, startOfDayNZ, todayNZ } from "~/lib/aucklandDay";

/**
 * What the admin dashboard counts, and on which day. `~/server/dashboard` runs the queries.
 *
 * Kept free of the database so the day and the money can be tested in CI, where there is
 * none.
 */

/**
 * The Auckland calendar day `now` falls in, from midnight to its last millisecond.
 *
 * Never the server's own day: the dashboard used `setHours` on the server's clock, which
 * on Vercel is UTC, so in daylight saving its "today" ran from 1 PM to 1 PM. For the first
 * hour of trading, Sales Today still showed the afternoon before.
 */
export const dashboardDay = (now: Date): { start: Date; end: Date } => {
  const day = todayNZ(now);
  return { start: startOfDayNZ(day), end: endOfDayNZ(day) };
};

/**
 * What a customer paid for an order, or customers for a set of orders from the sums of
 * their two price columns.
 *
 * An app order stores its price before discounts in `priceInCents` and the discount
 * (member price, promotion, offer, points) in `discountedAmountInCents`, and charges the
 * difference (`calculateCartPrice` in the order server). A website order stores what was
 * paid and leaves the discount at 0. So the difference is what was paid either way. The
 * dashboard summed `priceInCents` alone, which counted app discounts as sales, and the
 * admin Orders and Past Orders tables showed it as an order's amount.
 */
export const paidInCents = (sums: {
  priceInCents: number | null;
  discountedAmountInCents: number | null;
}): number => (sums.priceInCents ?? 0) - (sums.discountedAmountInCents ?? 0);

/**
 * Every status the kitchen has not finished with: not yet accepted, accepted, being made,
 * or ready and waiting. Collected and cancelled orders are finished. The dashboard counted
 * PENDING alone, so an order dropped out of Current Orders the moment a tablet accepted it.
 */
export const OPEN_ORDER_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "MAKING",
  "READY",
] as const;

export type SalesFigure = { orders: number; paidInCents: number };

export type DashboardFigures = {
  /** Open orders due today or overdue. */
  currentOrders: number;
  /** Orders picked up today. */
  collectedToday: number;
  /** Orders placed today, not cancelled, at what was paid. */
  salesToday: SalesFigure;
  /** Every order ever placed, not cancelled, at what was paid. */
  totalSales: SalesFigure;
};
