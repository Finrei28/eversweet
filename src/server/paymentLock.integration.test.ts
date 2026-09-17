import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { describeIfDb } from "~/test/db";
import { withPaymentLock } from "./paymentLock";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs `work` under the lock and records when it started and finished. */
const timed = async (paymentIntentId: string, holdMs: number) => {
  let started = 0;
  let finished = 0;
  await withPaymentLock(paymentIntentId, async () => {
    started = Date.now();
    await sleep(holdMs);
    finished = Date.now();
  });
  return { started, finished };
};

/**
 * The lock `attachCheckoutCustomer` runs under, in Postgres - so calls for the same payment
 * take turns across separate requests and separate server instances, not just in one process.
 */
describeIfDb("withPaymentLock", { timeout: 30_000 }, () => {
  it("makes calls for the same payment take turns", async () => {
    const [first, second] = await Promise.all([
      timed("pi_lock_same", 400),
      sleep(50).then(() => timed("pi_lock_same", 50)),
    ]);

    expect(second.started).toBeGreaterThanOrEqual(first.finished);
  });

  it("lets calls for different payments run together", async () => {
    const [first, second] = await Promise.all([
      timed("pi_lock_one", 400),
      sleep(50).then(() => timed("pi_lock_two", 50)),
    ]);

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
