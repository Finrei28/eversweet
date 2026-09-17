import "server-only";

import { db } from "~/server/db";
import type { PaymentLock } from "~/server/stripeCustomer";

/**
 * Runs `work` inside a transaction holding a Postgres advisory lock on one payment intent,
 * so two requests for the same payment - even on different Vercel instances - take turns.
 * The lock is transaction-scoped, so it is released however `work` ends, and it holds
 * through the pooled connection (`pgbouncer=true`, transaction mode). The order server takes
 * the same lock on the same key for app payments (`lockPayment` in its `lib/orderPayment`).
 *
 * `work` makes Stripe calls while the transaction stays open, which is why the timeout is
 * well past Prisma's 5-second default: attaching a customer is a retrieve, a list, a create
 * and an update.
 */
export const withPaymentLock: PaymentLock = (paymentIntentId, work) =>
  db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${paymentIntentId}, 0))`;
      return work();
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
