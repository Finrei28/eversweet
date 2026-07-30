import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const storeRouter = createTRPCRouter({
  getDaysOff: publicProcedure.query(async ({ ctx }) => {
    const daysOff = await ctx.db.daysOff.findMany({ select: { date: true } });
    const dates = daysOff.map((day) => day.date);
    return dates;
  }),
});
