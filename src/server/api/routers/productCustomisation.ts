import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const productCustomisationRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        priceInCents: z.coerce.number().int().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.dessertCustomisation.create({
        data: {
          name: input.name,
          priceInCents: input.priceInCents,
        },
      });
    }),

  dessertCustomisations: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.dessertCustomisation.findMany();
  }),

  update: protectedProcedure
    .input(
      z.object({
        updates: z.array(
          z.object({
            id: z.string(),
            isAvailableForPurchase: z.boolean().optional(),
            priceInCents: z.coerce.number().int().min(1).optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updatePromises = input.updates.map((customization) =>
        ctx.db.dessertCustomisation.update({
          where: { id: customization.id },
          data: {
            isAvailableForPurchase: customization.isAvailableForPurchase,
            priceInCents: customization.priceInCents,
          },
        }),
      );

      return await ctx.db.$transaction(updatePromises);
    }),

  availableDessertCustomisations: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.dessertCustomisation.findMany({
      where: { isAvailableForPurchase: true },
      orderBy: { priceInCents: "asc" },
      select: {
        id: true,
        name: true,
        priceInCents: true,
      },
    });
  }),
});
