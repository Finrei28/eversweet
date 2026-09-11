import "server-only";

import { env } from "~/env";

const ANNOUNCE_PATH = "/api/internal/orders/announce";

/**
 * How long to wait before giving up on the kitchen.
 *
 * Short on purpose. This runs after the customer's payment has gone through
 * and while they are waiting on the confirmation screen, so a slow or hanging
 * order server must not hold up their response. Missing the announcement costs
 * a couple of minutes; the backend's cron sweeps for orders it has not shown
 * yet and announces this one on its next pass.
 */
const TIMEOUT_MS = 1500;

/** Network blips are common and cheap to retry. A refusal is not. */
const RETRYABLE_STATUS = (status: number) => status >= 500;

type Target = { baseUrl: string; secret: string };

const post = async (
  { baseUrl, secret }: Target,
  orderId: string,
  signal: AbortSignal,
) =>
  fetch(`${baseUrl}${ANNOUNCE_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-service-secret": secret,
    },
    body: JSON.stringify({ orderId }),
    signal,
    cache: "no-store",
  });

/**
 * Tell the order-management app about an order that has just been paid for.
 *
 * Never throws, and never rejects. By the time this is called the payment has
 * been taken and the order is committed — there is no failure here worth
 * turning into an error for the customer, because there is nothing they could
 * do about it and nothing to undo. Failures are logged and left to the cron.
 *
 * Safe to call more than once for the same order: the endpoint is idempotent.
 */
export const announceOrder = async (orderId: string): Promise<void> => {
  const baseUrl = env.ADMIN_SERVER_URL;
  const secret = env.INTERNAL_SERVICE_SECRET;

  // Not configured — local development, or a preview deploy without the
  // secret. Say so rather than failing, and let the cron do the work.
  if (!baseUrl || !secret) {
    console.warn(
      `Order ${orderId}: admin announcement is not configured; the order server's cron will pick it up.`,
    );
    return;
  }

  const target: Target = { baseUrl, secret };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await post(
        target,
        orderId,
        AbortSignal.timeout(TIMEOUT_MS),
      );

      if (response.ok) return;

      if (!RETRYABLE_STATUS(response.status) || attempt === 2) {
        console.error(
          `Order ${orderId}: admin announcement refused with ${response.status}.`,
        );
        return;
      }
    } catch (error) {
      // Timeout, DNS, connection refused. The order stands regardless.
      if (attempt === 2) {
        console.error(
          `Order ${orderId}: admin announcement failed.`,
          error instanceof Error ? error.message : error,
        );
        return;
      }
    }
  }
};
