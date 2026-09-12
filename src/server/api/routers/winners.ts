import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { upsertRewardSchema } from "~/app/components/schemas";
import { endOfDayNZ } from "~/lib/winnerRewards";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { generateRewardCode } from "~/server/rewardCode";

/**
 * Monthly leaderboard winners and the prize each one collects in store.
 *
 * Read-only on winners themselves: the rows come from settleMonthlyWinners on the order
 * server, which ranks the month and writes one row per place. Nothing here creates,
 * ranks or closes anything.
 *
 * Read-only on redemption too. The code is typed in at the counter through the admin
 * *mobile* app, which is what stamps redeemedAt and redeemedByAdminId. No procedure in
 * this file writes either field, and `upsertReward`'s input has no shape that could.
 *
 * protectedProcedure is the admin gate. Only ADMIN users can authenticate on this site
 * at all - src/server/auth/config.ts `authorize()` returns null for everyone else - so
 * "signed in" and "is an admin" are the same statement. If that ever stops being true,
 * every procedure in this file needs a role check before it is deployed. This one mints
 * prizes.
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

/**
 * 30^8 codes against a table that holds a few dozen rows makes a collision a formality
 * rather than a risk, but the unique index is the only thing that actually decides, so
 * we let it: catching P2002 beats a findUnique check, which is two statements with a
 * gap in between.
 */
const CODE_ATTEMPTS = 5;

const isCodeCollision = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002" &&
  (error.meta?.target as string[] | undefined)?.includes("code");

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
   * winner already have a reward", and the server knows that without being told.
   */
  upsertReward: protectedProcedure
    .input(upsertRewardSchema)
    .mutation(async ({ ctx, input }) => {
      const winner = await ctx.db.loyaltyWinner.findUnique({
        where: { id: input.winnerId },
        select: {
          id: true,
          userId: true,
          month: true,
          year: true,
          reward: { select: { id: true, redeemedAt: true } },
        },
      });

      if (!winner) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Winner not found" });
      }

      // LoyaltyWinner.userId is SetNull on account deletion, so a null here means the
      // winner closed their account. There is nobody left to hand a prize to and the
      // reward would be permanently unclaimable.
      if (!winner.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This winner's account has been closed.",
        });
      }

      // The code has already been typed in at the counter and the prize handed over.
      // Editing the title now would rewrite what happened.
      if (winner.reward?.redeemedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This reward has already been redeemed and cannot be changed.",
        });
      }

      const expiresAt = endOfDayNZ(input.expiresAt);

      if (winner.reward) {
        // code and assignedByAdminId are left alone: the winner is already looking at
        // that code in the app, and assignedBy records who first granted the prize.
        return ctx.db.winnerReward.update({
          where: { winnerId: winner.id },
          data: {
            title: input.title,
            description: input.description ?? null,
            expiresAt,
          },
          select: rewardSelect,
        });
      }

      for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
        try {
          return await ctx.db.winnerReward.create({
            data: {
              winnerId: winner.id,
              title: input.title,
              description: input.description ?? null,
              expiresAt,
              assignedByAdminId: ctx.session.user.id,
              code: generateRewardCode(),
            },
            select: rewardSelect,
          });
        } catch (error) {
          if (isCodeCollision(error)) continue;

          // A P2002 on winnerId is two admins assigning the same winner at once, not a
          // code collision. Retrying would spin five times and then report the wrong
          // reason, so it goes up as itself.
          throw error;
        }
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not generate a unique reward code. Please try again.",
      });
    }),
});
