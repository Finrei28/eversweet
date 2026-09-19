import { offerRouter } from "~/server/api/routers/offers";
import { settingsRouter } from "~/server/api/routers/settings";
import { winnerRouter } from "~/server/api/routers/winners";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { db } from "~/server/db";

/**
 * A server-side tRPC caller over just the admin routers under test.
 *
 * Deliberately **not** `~/server/api/root`. The root router reaches the order router,
 * which imports an email template whose JSX will not compile under the Next `tsconfig`
 * Vitest is reading — the file fails to load before a single test runs. Nothing here
 * needs the other routers, so it composes its own.
 *
 * The caller runs the real procedures against the real database: zod parsing, the
 * `protectedProcedure` gate, the transaction in `updateOffer` and the diff logic inside
 * it. That is the point — what these tests prove is the database's behaviour, and a
 * mocked `ctx.db` would only assert the mock was called.
 */
const createCaller = createCallerFactory(
  createTRPCRouter({
    offer: offerRouter,
    winner: winnerRouter,
    settings: settingsRouter,
  }),
);

/**
 * Stands in for the admin who is signed in. It needs no `User` row: nothing here writes
 * it anywhere with a foreign key, and `winners.test.ts` only asserts it is the `adminId`
 * sent to the order server. `adminCaller` takes an id so a test can play a second admin.
 */
export const ADMIN_ID = "admin-test";

/**
 * The context is a plain object. `protectedProcedure` only checks that
 * `ctx.session.user` exists, and `createTRPCContext` — the thing that would normally
 * call `auth()` — is never involved in a server-side caller, so there is no session to
 * fake beyond this.
 *
 * Built to the real augmented `Session` (see the `declare module` at the foot of
 * `src/server/auth/config.ts`) rather than cast past the type. `role` is carried there
 * but nothing authorises on it: only admins can authenticate on this site at all, so
 * `protectedProcedure` *is* the admin gate. If a customer login is ever added, these
 * routers need a role check and this caller is where the test for it starts.
 */
export const adminCaller = (adminId: string = ADMIN_ID) =>
  createCaller({
    db,
    session: {
      user: { id: adminId, role: "ADMIN", email: "admin@eversweet.test" },
      expires: "2099-01-01T00:00:00.000Z",
    },
    headers: new Headers(),
  });
