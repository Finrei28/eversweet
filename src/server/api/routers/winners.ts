import {
  settleMonthSchema,
  upsertRewardSchema,
} from "~/app/components/schemas";
import { endOfDayNZ } from "~/lib/winnerRewards";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { callOrderServer } from "~/server/orderServer";

/**
 * Monthly leaderboard winners and the prize each one collects in store.
 *
 * **Reads here, writes on the order server.** `getWinners` reads the database directly;
 * assigning a prize and settling a missed month both go through `callOrderServer`. The
 * order server is where a prize code is minted, where the winner is sent a push, and
 * where every guard lives — this file used to write the reward row itself, with its own
 * copy of the code generator and no way to notify anyone, so a prize assigned here arrived
 * in silence and the two code generators had to be kept identical by hand.
 *
 * Winners themselves come from settleMonthlyWinners on the order server, which ranks the
 * month and writes one row per place. Redemption is the admin *mobile* app's job: nothing
 * here stamps `redeemedAt`.
 *
 * protectedProcedure is the admin gate. Only ADMIN users can authenticate on this site
 * at all - src/server/auth/config.ts `authorize()` returns null for everyone else - so
 * "signed in" and "is an admin" are the same statement. If that ever stops being true,
 * every procedure in this file needs a role check before it is deployed: the order
 * server trusts the admin id this file sends it.
 */

const rewardSelect = {
  id: true,
  title: true,
  description: true,
  code: true,
  expiresAt: true,
  assignedAt: true,
  assignedByAdminId: true,
  redeemedAt: true,
  redeemedByAdminId: true,
} as const;

/** What the order server answers when a prize is saved. */
type SavedReward = {
  reward: { title: string; code: string; expiresAt: string };
  /** Whether a push went out. Only ever true on the first assign, never on an edit. */
  notified: boolean;
};

/** What the order server answers when a month is settled. A failure arrives as an error. */
export type SettleOutcome = {
  month: number;
  year: number;
  recorded: number;
  outcome: "RECORDED" | "ALREADY_SETTLED" | "NO_EARNERS";
};

export const winnerRouter = createTRPCRouter({
  getWinners: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.loyaltyWinner.findMany({
      relationLoadStrategy: "join",
      orderBy: [{ year: "desc" }, { month: "desc" }, { place: "asc" }],
      select: {
        id: true,
        month: true,
        year: true,
        place: true,
        points: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            anonymousEnabled: true,
          },
        },
        reward: { select: rewardSelect },
      },
    });
  }),

  /**
   * One procedure rather than assign + edit: the difference is entirely "does this
   * winner already have a reward", and the order server knows that without being told.
   *
   * The expiry is pinned to the end of the chosen Auckland day here, because interpreting
   * a click in the admin's browser calendar is this site's concern — see `endOfDayNZ`. The
   * order server receives an instant and does not second-guess it.
   */
  upsertReward: protectedProcedure
    .input(upsertRewardSchema)
    .mutation(async ({ ctx, input }) => {
      const { reward, notified } = await callOrderServer<SavedReward>(
        "PUT",
        "/api/internal/winners/reward",
        {
          winnerId: input.winnerId,
          title: input.title,
          description: input.description ?? null,
          expiresAt: endOfDayNZ(input.expiresAt).toISOString(),
          adminId: ctx.session.user.id,
        },
      );

      return {
        title: reward.title,
        code: reward.code,
        expiresAt: new Date(reward.expiresAt),
        notified,
      };
    }),

  /**
   * Settles a month the order server's cron missed — an outage or a deploy across NZ
   * midnight on the 1st. Nothing else ever writes a podium, so without this the month is
   * lost. Safe to press twice: the second answers `ALREADY_SETTLED` and writes nothing.
   */
  settleMonth: protectedProcedure
    .input(settleMonthSchema)
    .mutation(({ input }) =>
      callOrderServer<SettleOutcome>(
        "POST",
        "/api/internal/winners/settle",
        input,
      ),
    ),
});
