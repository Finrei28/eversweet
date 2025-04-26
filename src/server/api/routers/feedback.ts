import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";

export const feedbackRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      z.object({
        name: z.string().optional(),
        email: z.string().email(),
        rating: z.number().min(1),
        feedbackMessage: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const feedback = await ctx.db.feedback.create({
        data: {
          name: input.name,
          email: input.email,
          rating: input.rating,
          feedbackMessage: input.feedbackMessage,
        },
      });
      return feedback;
    }),

  getFeedbacks: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.feedback.findMany({
      orderBy: {
        rating: "asc",
      }
    })
  })
});
