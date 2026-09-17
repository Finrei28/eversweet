/**
 * The winner router's two writes, which both go to the order server.
 *
 * No database here: assigning a prize and settling a month are the order server's work,
 * and what they refuse to do is proven against a real Postgres there
 * (`prizeRedemption.integration.test.ts`, `monthlyWinners.integration.test.ts`). What this
 * site owns is the request it sends — the right path, the secret, the admin, and an expiry
 * pinned to the Auckland day that was chosen, whatever zone the server runs in — and
 * turning the answer into something the dialog can show. That is what is pinned here.
 *
 * `getWinners` still reads the database directly; see `winners.integration.test.ts`.
 */
import { DateTime, Settings } from "luxon";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { env } = vi.hoisted(() => ({
  env: {
    NODE_ENV: "test",
    ADMIN_SERVER_URL: "https://orders.example.test",
    INTERNAL_SERVICE_SECRET: "service-secret",
  } as Record<string, string | undefined>,
}));

vi.mock("~/env", () => ({ env }));
// `orderServer` is `server-only`, which throws outside an RSC, and `trpc.ts` imports
// `~/server/auth` -> next-auth -> `next/server`, which will not resolve under Vitest. A
// server-side caller never calls `auth()`, so the stub costs nothing.
vi.mock("server-only", () => ({}));
vi.mock("~/server/auth", () => ({ auth: vi.fn(async () => null) }));

import { ADMIN_ID, adminCaller } from "~/test/caller";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const savedReward = (overrides: Record<string, unknown> = {}) =>
  json(201, {
    reward: {
      title: "One free dessert",
      code: "ABCD-2345",
      expiresAt: "2026-10-31T10:59:59.999Z",
    },
    notified: true,
    ...overrides,
  });

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

/** `timingMiddleware` sleeps on every call while `isDev`; see the note in `src/test/caller.ts`. */
describe("winner.upsertReward", { timeout: 30_000 }, () => {
  it("asks the order server to save the prize, as the signed-in admin", async () => {
    fetchMock.mockResolvedValue(savedReward());

    await adminCaller().winner.upsertReward({
      winnerId: "winner-1",
      title: "One free dessert",
      description: "Any bowl up to $12",
      expiresOn: "2026-10-31",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe("https://orders.example.test/api/internal/winners/reward");
    expect(init.method).toBe("PUT");
    expect(init.headers).toMatchObject({
      "x-service-secret": "service-secret",
    });

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      winnerId: "winner-1",
      title: "One free dessert",
      description: "Any bowl up to $12",
      adminId: ADMIN_ID,
    });

    // Valid through the whole of the day the admin chose, in Auckland.
    expect(
      DateTime.fromISO(body.expiresAt as string)
        .setZone("Pacific/Auckland")
        .toFormat("yyyy-LL-dd HH:mm:ss.SSS"),
    ).toBe("2026-10-31 23:59:59.999");
  });

  /**
   * Vercel runs in UTC. The router used to read the day off the calendar's `Date` itself,
   * which passed here on a machine in Auckland and sent the end of 30 October from
   * production.
   */
  it("sends the same expiry when the server runs in UTC", async () => {
    fetchMock.mockResolvedValue(savedReward());
    const previous = Settings.defaultZone;
    Settings.defaultZone = "UTC";

    try {
      await adminCaller().winner.upsertReward({
        winnerId: "winner-1",
        title: "One free dessert",
        expiresOn: "2026-10-31",
      });
    } finally {
      Settings.defaultZone = previous;
    }

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({
      expiresAt: "2026-10-31T10:59:59.999Z",
    });
  });

  // The order server keeps the deadline it has when none is sent, so rewording a prize
  // cannot move it.
  it("leaves the expiry out of the request when no day is sent", async () => {
    fetchMock.mockResolvedValue(savedReward());

    await adminCaller().winner.upsertReward({
      winnerId: "winner-1",
      title: "Two free desserts",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).not.toHaveProperty("expiresAt");
  });

  it("rejects a day that is not a real date before asking the order server", async () => {
    await expect(
      adminCaller().winner.upsertReward({
        winnerId: "winner-1",
        title: "One free dessert",
        expiresOn: "2026-02-30",
      }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the code and whether the winner was told", async () => {
    fetchMock.mockResolvedValue(savedReward());

    const saved = await adminCaller().winner.upsertReward({
      winnerId: "winner-1",
      title: "One free dessert",
      expiresOn: "2026-10-31",
    });

    expect(saved).toEqual({
      title: "One free dessert",
      code: "ABCD-2345",
      expiresAt: new Date("2026-10-31T10:59:59.999Z"),
      notified: true,
    });
  });

  it("sends a missing description as null rather than leaving it out", async () => {
    fetchMock.mockResolvedValue(savedReward());

    await adminCaller().winner.upsertReward({
      winnerId: "winner-1",
      title: "One free dessert",
      expiresOn: "2026-10-31",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({
      description: null,
    });
  });

  // The order server words its refusals for staff; paraphrasing them here would only
  // lose the detail.
  it("shows the order server's own refusal", async () => {
    fetchMock.mockResolvedValue(
      json(409, {
        message: "This prize has already been collected and cannot be changed",
      }),
    );

    await expect(
      adminCaller().winner.upsertReward({
        winnerId: "winner-1",
        title: "Changed",
        expiresOn: "2026-10-31",
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This prize has already been collected and cannot be changed",
    });
  });

  it("says the order server did not respond when it cannot be reached", async () => {
    fetchMock.mockRejectedValue(
      new DOMException("The operation timed out.", "TimeoutError"),
    );

    await expect(
      adminCaller().winner.upsertReward({
        winnerId: "winner-1",
        title: "One free dessert",
        expiresOn: "2026-10-31",
      }),
    ).rejects.toMatchObject({
      code: "TIMEOUT",
      message: expect.stringMatching(/did not respond/),
    });
  });

  // A 401 here is a mismatched secret between the two deploys, not a lapsed session.
  it("blames the credentials, not the admin, when the secret is refused", async () => {
    fetchMock.mockResolvedValue(json(401, { message: "Unauthorised" }));

    await expect(
      adminCaller().winner.upsertReward({
        winnerId: "winner-1",
        title: "One free dessert",
        expiresOn: "2026-10-31",
      }),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/INTERNAL_SERVICE_SECRET/),
    });
  });

  /**
   * A success in a shape this site does not know - most likely the two deploys drifting
   * apart. It used to be cast and read, so a missing `reward` crashed on `reward.title`
   * with a raw TypeError for a prize the order server may well have saved.
   */
  it.each([
    ["without the reward", { notified: true }],
    [
      "with an expiry that is not a date",
      {
        reward: { title: "One free dessert", code: "ABCD-2345", expiresAt: 0 },
        notified: true,
      },
    ],
    ["that is not JSON", null],
  ])(
    "says it cannot tell whether a prize was saved when the answer comes back %s",
    async (_label, body) => {
      fetchMock.mockResolvedValue(
        body === null
          ? new Response("<html>OK</html>", { status: 201 })
          : json(201, body),
      );

      await expect(
        adminCaller().winner.upsertReward({
          winnerId: "winner-1",
          title: "One free dessert",
          expiresOn: "2026-10-31",
        }),
      ).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
        message: expect.stringMatching(/cannot tell whether this was saved/),
      });
    },
  );

  // Refusing out loud: a silent no-op would read as a prize that was saved and simply
  // never turned up.
  it("refuses, and calls nothing, when the order server is not configured", async () => {
    env.ADMIN_SERVER_URL = undefined;

    await expect(
      adminCaller().winner.upsertReward({
        winnerId: "winner-1",
        title: "One free dessert",
        expiresOn: "2026-10-31",
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringMatching(/ADMIN_SERVER_URL/),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("winner.settleMonth", { timeout: 30_000 }, () => {
  it("asks the order server to settle the month and returns what happened", async () => {
    fetchMock.mockResolvedValue(
      json(200, { month: 8, year: 2026, recorded: 3, outcome: "RECORDED" }),
    );

    const result = await adminCaller().winner.settleMonth({
      month: 8,
      year: 2026,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://orders.example.test/api/internal/winners/settle");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ month: 8, year: 2026 });
    expect(result).toEqual({
      month: 8,
      year: 2026,
      recorded: 3,
      outcome: "RECORDED",
    });
  });

  // The order server answers a failed settle with a 500 now; it used to be a 200 that
  // looked like a month nobody had earned in.
  it("surfaces a failed settle as an error, never as an outcome", async () => {
    fetchMock.mockResolvedValue(
      json(500, {
        month: 8,
        year: 2026,
        recorded: 0,
        outcome: "FAILED",
        message: "Failed to settle that month",
      }),
    );

    await expect(
      adminCaller().winner.settleMonth({ month: 8, year: 2026 }),
    ).rejects.toMatchObject({ message: "Failed to settle that month" });
  });

  /**
   * The dialog words one toast per known outcome and shows anything else as "nobody
   * earned points". A success carrying an outcome it does not know - or none - must
   * never reach it.
   */
  it.each([
    [
      "an outcome it does not know",
      { month: 8, year: 2026, recorded: 0, outcome: "FAILED" },
    ],
    ["no count", { month: 8, year: 2026, outcome: "RECORDED" }],
  ])(
    "never reports a settle that comes back with %s as a success",
    async (_label, body) => {
      fetchMock.mockResolvedValue(json(200, body));

      await expect(
        adminCaller().winner.settleMonth({ month: 8, year: 2026 }),
      ).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
        message: expect.stringMatching(/does not understand/),
      });
    },
  );

  it("rejects a month outside 1 to 12 before asking the order server", async () => {
    await expect(
      adminCaller().winner.settleMonth({ month: 13, year: 2026 }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
