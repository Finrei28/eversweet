import { TRPCError } from "@trpc/server";
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
        chineseName: z.string(),
        priceInCents: z.coerce.number().int().min(1),
        categories: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const exists = await ctx.db.dessertCustomisation.findFirst({
        where: {
          OR: [{ name: input.name }, { chineseName: input.chineseName }],
        },
      });
      if (exists) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Customisation already exists | 定制已有",
        });
      }

      if (!input.categories.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "At least one category is required | 至少需要一个类别",
        });
      }

      return await ctx.db.dessertCustomisation.create({
        data: {
          name: input.name,
          chineseName: input.chineseName,
          priceInCents: input.priceInCents,
          categories: {
            create: input.categories.map((categoryId) => ({
              category: { connect: { id: categoryId } },
            })),
          },
        },
      });
    }),

  dessertCustomisations: publicProcedure.query(async ({ ctx }) => {
    const customisations = await ctx.db.dessertCustomisation.findMany({
      include: {
        categories: {
          include: {
            category: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    // Map over the result to extract just the `category` objects
    return customisations.map((customisation) => ({
      ...customisation,
      categories: customisation.categories.map((c) => c.category),
    }));
  }),

  updateMany: protectedProcedure
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

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        isAvailableForPurchase: z.boolean().optional(),
        priceInCents: z.coerce.number().int().min(1),
        name: z.string().min(1),
        chineseName: z.string().min(1),
        categories: z.array(z.string().min(1)),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existingCustomisation =
        await ctx.db.dessertCustomisation.findUnique({
          where: { id: input.id },
          include: { categories: true }, // Get linked categories
        });

      // Extract current category IDs
      const existingCategoryIds =
        existingCustomisation?.categories.map((c) => c.categoryId) || [];

      // Sort and stringify arrays to compare
      const categoriesChanged =
        JSON.stringify(existingCategoryIds.sort()) !==
        JSON.stringify(input.categories.sort());

      // Prepare base update data
      const updateData: any = {
        isAvailableForPurchase: input.isAvailableForPurchase,
        priceInCents: input.priceInCents,
        name: input.name,
        chineseName: input.chineseName,
      };

      // If categories changed, include delete & create logic
      if (categoriesChanged) {
        updateData.categories = {
          deleteMany: {}, // Remove all existing categories
          create: input.categories.map((categoryId) => ({
            category: { connect: { id: categoryId } },
          })),
        };
      }

      // Perform update
      const updatedCustomisations = await ctx.db.dessertCustomisation.update({
        where: { id: input.id },
        data: updateData,
        include: {
          categories: {
            include: {
              category: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });
      return {
        ...updatedCustomisations,
        categories: updatedCustomisations.categories.map((c) => c.category),
      };
    }),

  availableDessertCustomisations: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db.dessertCustomisation.findMany({
      where: { isAvailableForPurchase: true },
      orderBy: { priceInCents: "asc" },
      select: {
        id: true,
        chineseName: true,
        name: true,
        priceInCents: true,
      },
    });
  }),
});
