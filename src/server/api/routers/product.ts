import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  addSchema,
  createProductSchema,
  updateProductSchema,
} from "~/app/components/schemas";
import fs from "fs/promises";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const productRouter = createTRPCRouter({
  //getMostPopularProducts
  getMostPopularProducts: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db.dessert.findMany();

    // const popularDesserts = await ctx.db.orderDessert.groupBy({
    //   by: ["dessertId"],
    //   _sum: {
    //     quantity: true, // Sum up the quantity of each dessert
    //   },
    //   orderBy: {
    //     _sum: {
    //       quantity: "desc", // Order by the most ordered desserts
    //     },
    //   },
    //   take: 10, // Get the top 10
    // });
    // console.log(popularDesserts);
    // // Fetch the actual dessert details
    // const desserts = await ctx.db.dessert.findMany({
    //   where: {
    //     id: { in: popularDesserts.map((d) => d.dessertId) }, // Get desserts with matching IDs
    //   },
    //   select: {
    //     id: true,
    //     name: true,
    //     chineseName: true,
    //     description: true,
    //     priceInCents: true,
    //     imagePath: true,
    //     ingredients: true,
    //     isAvailableForPurchase: true,
    //   },
    // });
    // return desserts;
  }),

  //get products for menu display
  getProductsForMenu: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db.dessert.findMany({
      where: {
        isAvailableForPurchase: true,
      },
      orderBy: {
        priceInCents: "asc",
      },
      select: {
        id: true,
        name: true,
        chineseName: true,
        priceInCents: true,
        imagePath: true,
        ingredients: true,
        description: true,
      },
    });
  }),

  createProduct: protectedProcedure
    .input(z.object({ product: createProductSchema }))
    .mutation(async ({ ctx, input }) => {
      const data = input.product;
      const existingDessert = await ctx.db.dessert.findFirst({
        where: {
          OR: [{ name: data.name }, { chineseName: data.chineseName }],
        },
      });

      if (existingDessert) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Dessert already exists",
        });
      }

      // Ensure image is provided
      if (!data.imagePath) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Image is required",
        });
      }

      // Process ingredients
      const ingredientsArray = data.ingredients
        ? data.ingredients.split(",").map((i) => i.trim())
        : [];

      // Save to database
      await ctx.db.dessert.create({
        data: {
          name: data.name,
          chineseName: data.chineseName,
          priceInCents: data.priceInCents,
          description: data.description,
          ingredients: ingredientsArray,
          imagePath: data.imagePath,
          imagePublicId: data.imagePublicId,
        },
      });

      return { message: "Product created successfully" };
    }),

  getProducts: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.dessert.findMany({
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        name: true,
        chineseName: true,
        priceInCents: true,
        imagePath: true,
        ingredients: true,
        description: true,
        isAvailableForPurchase: true,
      },
    });
  }),

  editProduct: protectedProcedure
    .input(z.object({ productToUpdate: updateProductSchema }))
    .mutation(async ({ ctx, input }) => {
      const data = input.productToUpdate;

      const exists = await ctx.db.dessert.findFirst({
        where: {
          id: data.id,
        },
      });

      if (!exists) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid dessert Id",
        });
      }

      const imagePath = data.imagePath ? data.imagePath : exists?.imagePath;
      const imagePublicId = data.imagePublicId
        ? data.imagePublicId
        : exists?.imagePublicId;

      const existingDessertName = await ctx.db.dessert.findFirst({
        where: {
          OR: [{ name: data.name }, { chineseName: data.chineseName }],
        },
      });

      if (existingDessertName && existingDessertName.id !== data.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Dessert name already exists",
        });
      }

      // Process ingredients
      const ingredientsArray = data.ingredients
        ? data.ingredients.split(",").map((i) => i.trim())
        : [];

      // Save to database
      await ctx.db.dessert.update({
        where: { id: data.id },
        data: {
          name: data.name,
          chineseName: data.chineseName,
          priceInCents: data.priceInCents,
          description: data.description,
          ingredients: ingredientsArray,
          imagePath: imagePath,
          imagePublicId: imagePublicId,
          isAvailableForPurchase: data.isAvailableForPurchase,
        },
      });

      return { message: "Product updated successfully" };
    }),
});
