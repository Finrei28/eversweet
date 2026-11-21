/**
 * An admin moving an order's status from the Orders or Past Orders table, through the order
 * server.
 *
 * No database here: the move is the order server's, and what it refuses is proven against a
 * real Postgres there (`websiteOrderStatus.integration.test.ts`). What this site owns is the
 * request it sends - the path, the secret, and the status the table showed - and reading the
 * answer. That is what is pinned here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { env } = vi.hoisted(() => ({
  env: {
    NODE_ENV: "test",
    ADMIN_SERVER_URL: "https://orders.example.test",
    INTERNAL_SERVICE_SECRET: "service-secret",
  } as Record<string, string | undefined>,
}));

vi.mock("~/env", () => ({ env }));
vi.mock("server-only", () => ({}));

import { changeOrderStatusSchema } from "~/app/components/schemas";
import { changeOrderStatus } from "./orderStatusChange";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const move = {
  orderId: "order-1",
  newStatus: "PICKED_UP",
  expectedStatus: "READY",
} as const;

beforeEach(() => {
  fetchMock.mockReset();
  env.ADMIN_SERVER_URL = "https://orders.example.test";
  env.INTERNAL_SERVICE_SECRET = "service-secret";
  // `callOrderServer` logs what went wrong; keep the test output about the tests.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("changeOrderStatus", () => {
  it("asks the order server to move the order from the status the table showed", async () => {
    fetchMock.mockResolvedValue(
      json(200, { outcome: "moved", status: "PICKED_UP" }),
    );

    await changeOrderStatus(move);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://orders.example.test/api/internal/orders/status");
    expect(init.method).toBe("PUT");
    expect(init.headers).toMatchObject({
      "x-service-secret": "service-secret",
    });
    expect(JSON.parse(init.body as string)).toEqual(move);
  });

  it("answers with the order's status once it has moved", async () => {
    fetchMock.mockResolvedValue(
      json(200, { outcome: "moved", status: "PICKED_UP" }),
    );

    await expect(changeOrderStatus(move)).resolves.toEqual({
      outcome: "moved",
      status: "PICKED_UP",
    });
  });

  // A tablet moved it, or cancelled it, since the table was read.
  it("answers with where the order is now when it has moved on", async () => {
    fetchMock.mockResolvedValue(
      json(200, { outcome: "changed", status: "CANCELLED" }),
    );

    await expect(changeOrderStatus(move)).resolves.toEqual({
      outcome: "changed",
      status: "CANCELLED",
    });
  });

  it("refuses an answer it cannot read rather than guess", async () => {
    fetchMock.mockResolvedValue(json(200, { success: true }));

    await expect(changeOrderStatus(move)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });

  it("passes on the order server's refusal", async () => {
    fetchMock.mockResolvedValue(json(404, { message: "Order not found" }));

    await expect(changeOrderStatus(move)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Order not found",
    });
  });

  it("refuses out loud when the order server is not configured", async () => {
    env.ADMIN_SERVER_URL = undefined;

    await expect(changeOrderStatus(move)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("changeOrderStatusSchema", () => {
  it("takes a move between the tablet's statuses", () => {
    expect(changeOrderStatusSchema.safeParse(move).success).toBe(true);
    expect(
      changeOrderStatusSchema.safeParse({
        ...move,
        newStatus: "READY",
        expectedStatus: "PICKED_UP",
      }).success,
    ).toBe(true);
  });

  it.each([
    [
      "an accept of a pending order",
      { newStatus: "ACCEPTED", expectedStatus: "PENDING" },
    ],
    [
      "a move back to pending",
      { newStatus: "PENDING", expectedStatus: "ACCEPTED" },
    ],
    ["a cancellation", { newStatus: "CANCELLED", expectedStatus: "READY" }],
    [
      "a move out of cancelled",
      { newStatus: "READY", expectedStatus: "CANCELLED" },
    ],
    [
      "a move to the status it has",
      { newStatus: "READY", expectedStatus: "READY" },
    ],
    ["no expected status", { newStatus: "READY", expectedStatus: undefined }],
    ["no order", { orderId: "" }],
  ])("refuses %s", (_label, change) => {
    expect(
      changeOrderStatusSchema.safeParse({ ...move, ...change }).success,
    ).toBe(false);
  });
});
