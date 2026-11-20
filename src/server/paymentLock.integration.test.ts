import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { describeIfDb } from "~/test/db";
import { withPaymentLock } from "./paymentLock";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `work` under the lock and records when it started and finished, calling `onLocked`
 * once it holds the lock.
 */
const timed = async (
  paymentIntentId: string,
  holdMs: number,
  onLocked: () => void = () => undefined,
) => {
  let started = 0;
  let finished = 0;
  await withPaymentLock(paymentIntentId, async () => {
    started = Date.now();
    onLocked();
    await sleep(holdMs);
    finished = Date.now();
  });
  return { started, finished };
};

/**
 * Starts a second call only once the first holds its lock, so the second always arrives
 * while the first is inside. A fixed head start did not ensure that: the first call of a
 * run opens a database connection, which took over 100ms on some runs, and the second then
 * took the lock first - one run in three or so failed for want of an order nobody promised.
 */
const whileFirstHoldsTheLock = async (
  first: { id: string; holdMs: number },
  second: { id: string; holdMs: number },
) => {
  let firstHasLock!: () => void;
  const locked = new Promise<void>((resolve) => (firstHasLock = resolve));
  const [a, b] = await Promise.all([
    timed(first.id, first.holdMs, firstHasLock),
    locked.then(() => timed(second.id, second.holdMs)),
  ]);
  return { first: a, second: b };
};

/**
 * The lock `attachCheckoutCustomer` runs under, in Postgres - so calls for the same payment
 * take turns across separate requests and separate server instances, not just in one process.
 */
describeIfDb("withPaymentLock", { timeout: 30_000 }, () => {
  it("makes calls for the same payment take turns", async () => {
    const { first, second } = await whileFirstHoldsTheLock(
      { id: "pi_lock_same", holdMs: 400 },
      { id: "pi_lock_same", holdMs: 50 },
    );

    expect(second.started).toBeGreaterThanOrEqual(first.finished);
  });

  it("lets calls for different payments run together", async () => {
    const { first, second } = await whileFirstHoldsTheLock(
      { id: "pi_lock_one", holdMs: 400 },
      { id: "pi_lock_two", holdMs: 50 },
    );

    expect(second.started).toBeLessThan(first.finished);
  });

  it("releases the lock when the work throws, and passes the error on", async () => {
    await expect(
      withPaymentLock("pi_lock_throws", async () => {
        throw new Error("Stripe refused");
      }),
    ).rejects.toThrow("Stripe refused");

    const startedAt = Date.now();
    await timed("pi_lock_throws", 0);
    expect(Date.now() - startedAt).toBeLessThan(2_000);
  });

  it("hands back what the work returns", async () => {
    expect(await withPaymentLock("pi_lock_value", async () => 42)).toBe(42);
  });
});
