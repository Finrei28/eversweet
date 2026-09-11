import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { env } = vi.hoisted(() => ({
  env: {
    ADMIN_SERVER_URL: "https://orders.example.test",
    INTERNAL_SERVICE_SECRET: "service-secret",
  } as Record<string, string | undefined>,
}));

vi.mock("~/env", () => ({ env }));
vi.mock("server-only", () => ({}));

import { announceOrder } from "./notifyAdmin";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const ok = () =>
  new Response(JSON.stringify({ status: "delivered" }), { status: 200 });
const status = (code: number) => new Response("", { status: code });

let errors: unknown[][];
let warnings: unknown[][];

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(ok());
  env.ADMIN_SERVER_URL = "https://orders.example.test";
  env.INTERNAL_SERVICE_SECRET = "service-secret";

  errors = [];
  warnings = [];
  vi.spyOn(console, "error").mockImplementation((...args) => {
    errors.push(args);
  });
  vi.spyOn(console, "warn").mockImplementation((...args) => {
    warnings.push(args);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("announceOrder", () => {
  it("posts the order id to the announce endpoint with the service secret", async () => {
    await announceOrder("order-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(
      "https://orders.example.test/api/internal/orders/announce",
    );
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ orderId: "order-1" }));
    expect(init.headers).toMatchObject({
      "x-service-secret": "service-secret",
    });
  });

  it("does not retry a successful announcement", async () => {
    await announceOrder("order-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(errors).toEqual([]);
  });

  it("retries once on a server error, then gives up quietly", async () => {
    fetchMock.mockResolvedValue(status(503));

    await announceOrder("order-1");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(errors).toHaveLength(1);
  });

  it("succeeds on the retry when the first attempt fails", async () => {
    fetchMock.mockResolvedValueOnce(status(500)).mockResolvedValueOnce(ok());

    await announceOrder("order-1");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(errors).toEqual([]);
  });

  // A refusal is a decision, not a blip. Retrying a rejected secret or a
  // malformed body just doubles the load for the same answer.
  it.each([[400], [401], [404]])("does not retry a %d", async (code) => {
    fetchMock.mockResolvedValue(status(code));

    await announceOrder("order-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(errors).toHaveLength(1);
  });

  it("retries a network failure and never lets it escape", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(announceOrder("order-1")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(errors).toHaveLength(1);
  });

  it("survives a timeout", async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new Error("The operation was aborted"), {
        name: "TimeoutError",
      }),
    );

    await expect(announceOrder("order-1")).resolves.toBeUndefined();
    expect(errors).toHaveLength(1);
  });

  // The whole point of this module: the customer has already been charged, so
  // nothing in here may become an error on their confirmation screen.
  it.each([
    [
      "a rejected promise",
      () => fetchMock.mockRejectedValue(new Error("boom")),
    ],
    [
      "a thrown string",
      () =>
        fetchMock.mockImplementation(() => {
          // Deliberately not an Error: a badly behaved polyfill or interceptor
          // can throw anything, and the guard has to hold for all of it.
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw "boom";
        }),
    ],
    ["a 500", () => fetchMock.mockResolvedValue(status(500))],
    ["a malformed response", () => fetchMock.mockResolvedValue(undefined)],
  ])("never throws on %s", async (_label, arrange) => {
    arrange();
    await expect(announceOrder("order-1")).resolves.toBeUndefined();
  });

  it.each([
    ["the url is missing", "ADMIN_SERVER_URL"],
    ["the secret is missing", "INTERNAL_SERVICE_SECRET"],
  ])("skips the call when %s", async (_label, key) => {
    env[key] = undefined;

    await announceOrder("order-1");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnings).toHaveLength(1);
    expect(errors).toEqual([]);
  });
});
