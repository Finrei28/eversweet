import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { DateTime } from "luxon";

export const storeRouter = createTRPCRouter({
  getDaysOff: publicProcedure.query(async ({ ctx }) => {
    const today = DateTime.now()
      .setZone("Pacific/Auckland")
      .startOf("day")
      .toJSDate();
    const daysOff = await ctx.db.daysOff.findMany({
      select: { date: true },
      where: { date: { gte: today } },
      orderBy: { date: "asc" },
    });
    const dates = daysOff.map((day) => day.date);
    return dates;
  }),
});
