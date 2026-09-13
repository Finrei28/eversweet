import "server-only";

import { TRPCError } from "@trpc/server";

import { env } from "~/env";

/**
 * Calls the order server on behalf of an admin, and waits for the answer.
 *
 * `/admin/winners` writes prizes and settles missed months through here rather than
 * against the database. The order server is the one place a prize code is minted, the
 * one place a winner is pushed a notification, and the one place the guards live; this
 * site used to write the reward row itself with its own copy of the code generator and
 * no way to notify anyone, so a prize assigned here reached the customer only if they
 * happened to open the app.
 *
 * The same channel as `notifyAdmin.ts`, with the opposite contract. That one is
 * fire-and-forget, because a paid order must never wait on the kitchen. This one's
 * result *is* the answer, so it throws a `TRPCError` the dialog can show.
 */

/**
 * Inside Vercel's default 10s function limit, with room for the order server's own round
 * trips to Sydney. A timeout is safe to retry: a first call that committed but did not
 * answer in time leaves a reward the retry then finds and edits in place, with the same
 * code and no second push.
 */
const TIMEOUT_MS = 8000;

const NOT_CONFIGURED =
  "The order server is not configured, so this cannot be done from here. Set ADMIN_SERVER_URL and INTERNAL_SERVICE_SECRET.";

const NO_RESPONSE = "The order server did not respond. Try again in a moment.";

/** The order server's statuses, as the codes the tRPC client understands. */
const codeFor = (status: number): TRPCError["code"] => {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 429:
      return "TOO_MANY_REQUESTS";
    default:
      return "INTERNAL_SERVER_ERROR";
  }
};

export const callOrderServer = async <T>(
  method: "POST" | "PUT",
  path: string,
  body: unknown,
): Promise<T> => {
  const baseUrl = env.ADMIN_SERVER_URL;
  const secret = env.INTERNAL_SERVICE_SECRET;

  // Refuse out loud. Silently doing nothing would read, from the dialog, as a prize that
  // was assigned and simply never turned up.
  if (!baseUrl || !secret) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: NOT_CONFIGURED,
    });
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-service-secret": secret,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    console.error(
      `Order server ${method} ${path} failed:`,
      error instanceof Error ? error.message : error,
    );
    throw new TRPCError({ code: "TIMEOUT", message: NO_RESPONSE });
  }

  const payload = (await response.json().catch(() => null)) as
    | (T & { message?: unknown })
    | null;

  if (response.ok && payload) return payload;

  // A wrong or missing secret. Nothing the admin can fix from the dialog, and "Unauthorised"
  // would suggest their own session had lapsed.
  if (response.status === 401) {
    console.error(
      `Order server refused ${path}: the service secret does not match.`,
    );
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "The order server did not accept this site's credentials. Check INTERNAL_SERVICE_SECRET matches on both.",
    });
  }

  // The order server words its refusals for staff ("This prize has already been
  // collected..."), and keeps causes out of its 500s, so its message is the one to show.
  const message =
    typeof payload?.message === "string" && payload.message
      ? payload.message
      : response.status >= 500
        ? NO_RESPONSE
        : `The order server refused this (${response.status}).`;

  throw new TRPCError({ code: codeFor(response.status), message });
};
