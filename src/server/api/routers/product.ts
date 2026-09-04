import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createProductSchema,
  updateProductSchema,
} from "~/app/components/schemas";

import { unstable_cache, revalidateTag } from "next/cache";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";

/**
 * Everything the customer-facing menu renders is cached under this tag, and
 * every product mutation drops it. The menu changes a handful of times a month
 * but is read on every page load, and each uncached read costs a ~160ms round
 * trip to the database.
 */
export const MENU_CACHE_TAG = "menu";

const MENU_CACHE_SECONDS = 300;

/**
 * Cached readers.
 *
 * These live outside the router so `unstable_cache` wraps them exactly once at
 * module load rather than on every request. They use the `db` singleton
 * directly for the same reason - `ctx.db` is that same instance.
 *
 * `relationLoadStrategy: "join"` collapses each `include`/nested `select` into
 * a single SQL join. Without it Prisma issues one query per relation, and
 * against a remote database every one of those is a fresh ~160ms round trip.
 */
const getMostPopularProductsCached = unstable_cache(
  async () => {
    const popularDesserts = await db.orderDessert.groupBy({
      by: ["dessertId"],
      _sum: {
        quantity: true, // Sum up the quantity of each dessert
      },
      orderBy: {
        _sum: {
          quantity: "desc", // Order by the most ordered desserts
        },
      },
      take: 10, // Get the top 10
    });
    // Fetch the actual dessert details
    const rawDesserts = await db.dessert.findMany({
      relationLoadStrategy: "join",
      where: {
        id: { in: popularDesserts.map((d) => d.dessertId) }, // Get desserts with matching IDs
      },
      select: {
        id: true,
        name: true,
        chineseName: true,
        description: true,
        priceInCents: true,
        imagePath: true,
        ingredients: { include: { ingredient: true } },
        categoryId: true,
        promo: true,
      },
    });
    return rawDesserts.map((dessert) => ({
      ...dessert,
      ingredients: dessert.ingredients.map((i) => i.ingredient),
    }));
  },
  ["most-popular-products"],
  { revalidate: MENU_CACHE_SECONDS, tags: [MENU_CACHE_TAG] },
);

/**
 * `unstable_cache` round-trips its payload through the Next.js data cache,
 * which does not preserve `Date` instances. The menu payload carries
 * `promo.startsAt` / `promo.endsAt`, and `dessertOnClient` types those as real
 * `Date`s, so rebuild them on the way out. `new Date(x)` is a no-op clone when
 * `x` is already a Date, so this is correct cached or not.
 */
const revivePromoDates = <
  T extends {
    promo: { startsAt: Date | null; endsAt: Date | null } | null;
  },
>(
  dessert: T,
): T =>
  dessert.promo
    ? {
        ...dessert,
        promo: {
          ...dessert.promo,
          startsAt: dessert.promo.startsAt
            ? new Date(dessert.promo.startsAt)
            : null,
          endsAt: dessert.promo.endsAt ? new Date(dessert.promo.endsAt) : null,
        },
      }
    : dessert;

const getProductsForMenuByCategoryCached = unstable_cache(
  async () => {
    const rawProducts = await db.category.findMany({
      relationLoadStrategy: "join",
      orderBy: { sortOrder: "asc" },
      include: {
        desserts: {
          where: { isAvailableForPurchase: true },
          orderBy: { priceInCents: "asc" },
          select: {
            id: true,
            name: true,
            chineseName: true,
            priceInCents: true,
            imagePath: true,
            ingredients: { include: { ingredient: true } },
            description: true,
            promo: true,
          },
        },
      },
    });
    return rawProducts.map((category) => ({
      ...category,
      desserts: category.desserts.map((dessert) => ({
        ...dessert,
        ingredients: dessert.ingredients.map((i) => i.ingredient),
      })),
    }));
  },
  ["products-for-menu-by-category"],
  { revalidate: MENU_CACHE_SECONDS, tags: [MENU_CACHE_TAG] },
);

export const productRouter = createTRPCRouter({
  //getMostPopularProducts
  getMostPopularProducts: publicProcedure.query(async () => {
    const desserts = await getMostPopularProductsCached();
    return desserts.map(revivePromoDates);
  }),

  //get products for menu display
  getProductsForMenuByCategory: publicProcedure.query(async () => {
    const menu = await getProductsForMenuByCategoryCached();
    return menu.map((category) => ({
      ...category,
      desserts: category.desserts.map(revivePromoDates),
    }));
  }),

  getProductsForAdminByCategory: publicProcedure.query(async ({ ctx }) => {
    const rawProducts = await ctx.db.category.findMany({
      relationLoadStrategy: "join",
      orderBy: { sortOrder: "asc" },
      include: {
        desserts: {
          orderBy: { priceInCents: "asc" },
          select: {
            id: true,
            name: true,
            chineseName: true,
            priceInCents: true,
            imagePath: true,
            ingredients: { include: { ingredient: true } },
            description: true,
            isAvailableForPurchase: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const menu = rawProducts.map((category) => ({
      ...category,
      desserts: category.desserts.map((dessert) => ({
        ...dessert,
        ingredients: dessert.ingredients.map((i) => i.ingredient),
      })),
    }));
    return menu;
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

      // Save to database
      const product = await ctx.db.dessert.create({
        data: {
          name: data.name,
          chineseName: data.chineseName,
          priceInCents: data.priceInCents,
          description: data.description,
          ingredients: {
            create: data.ingredients.map((ingredient) => ({
              ingredient: {
                connect: { id: ingredient.id },
              },
            })),
          },
          imagePath: data.imagePath,
          imagePublicId: data.imagePublicId,
          category: {
            connect: {
              id: data.categoryId,
            },
          },
        },
      });

      // The customer-facing menu is cached; a product change must drop it now
      // rather than waiting out the revalidate window.
      revalidateTag(MENU_CACHE_TAG);

      return { name: product.name, chineseName: product.chineseName };
    }),

  getProducts: protectedProcedure.query(async ({ ctx }) => {
    const rawDesserts = await ctx.db.dessert.findMany({
      relationLoadStrategy: "join",
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        name: true,
        chineseName: true,
        priceInCents: true,
        imagePath: true,
        ingredients: { include: { ingredient: true } },
        description: true,
        isAvailableForPurchase: true,
        promo: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const desserts = rawDesserts.map((dessert) => ({
      ...dessert,
      ingredients: dessert.ingredients.map((i) => i.ingredient),
    }));
    return desserts;
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

      // Save to database
      const product = await ctx.db.dessert.update({
        where: { id: data.id },
        data: {
          name: data.name,
          chineseName: data.chineseName,
          priceInCents: data.priceInCents,
          description: data.description,
          ingredients: {
            // Remove all existing ingredients and add the new ones
            deleteMany: {},
            create: data.ingredients.map((ingredient) => ({
              ingredient: {
                connect: { id: ingredient.id },
              },
            })),
          },
          imagePath: imagePath,
          imagePublicId: imagePublicId,
          isAvailableForPurchase: data.isAvailableForPurchase,
          category: {
            connect: { id: data.categoryId }, // Change category
          },
        },
      });

      // The customer-facing menu is cached; a product change must drop it now
      // rather than waiting out the revalidate window.
      revalidateTag(MENU_CACHE_TAG);

      return { name: product.name, chineseName: product.chineseName };
    }),

  scanCart: publicProcedure
    .input(
      z.object({
        dessertIds: z.array(z.string().min(1)),
        customisationIds: z.array(z.string().min(1)),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Fetch available desserts

      const desserts = await ctx.db.dessert.findMany({
        where: { id: { in: input.dessertIds } },
        select: { id: true, name: true, isAvailableForPurchase: true },
      });

      // Fetch available customisations
      const customisations = await ctx.db.ingredient.findMany({
        where: {
          id: { in: input.customisationIds },
        },
        select: { id: true, name: true, isAvailableForPurchase: true },
      });

      // Convert found items to Sets for quick lookup
      const DessertIdsInDB = new Set(desserts.map((d) => d.id));
      const CustomisationIdsInDB = new Set(customisations.map((c) => c.id));
      // Find missing desserts/customisations
      const notFoundDesserts = input.dessertIds.filter(
        (id) => !DessertIdsInDB.has(id),
      );

      const notFoundCustomisations = input.customisationIds.filter(
        (id) => !CustomisationIdsInDB.has(id),
      );

      if (notFoundDesserts.length > 0 || notFoundCustomisations.length > 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `One of your items have been removed or updated, please remove your items from your cart and add them from the menu again. If this persists, please contact eversweet@eversweet.co.nz`,
        });
      }
      // Find unavailable dessert/customisations
      const unavailableDessert = desserts.filter(
        (d) =>
          input.dessertIds.includes(d.id) && d.isAvailableForPurchase === false,
      );

      const unavailableCustomisation = customisations.filter(
        (c) =>
          input.customisationIds.includes(c.id) &&
          c.isAvailableForPurchase === false,
      );

      const unavailableDessertNames = unavailableDessert.map(
        (dessert) => dessert.name,
      );
      const unavailableCustomisationNames = unavailableCustomisation.map(
        (customisation) => customisation.name,
      );

      if (
        unavailableDessert.length > 0 ||
        unavailableCustomisation.length > 0
      ) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `The following items are unavailable or have sold out: ${unavailableDessert.length > 0 ? `Desserts: ${unavailableDessertNames.join(", ")}. ` : ""}${unavailableCustomisation.length > 0 ? `Customisations: ${unavailableCustomisationNames.join(", ")}.` : ""} Please check your cart and update your selections.`,
        });
      }

      return { desserts, customisations };
    }),

  hasCartPriceChanged: publicProcedure
    .input(
      z.object({
        cartItems: z.array(
          z.object({
            dessertId: z.string().min(1),
            priceInCentsAfterPromo: z.number().int().nonnegative(),
          }),
        ),
      }),
    )
    .query(async ({ ctx, input }) => {
      const desserts = await ctx.db.dessert.findMany({
        where: { id: { in: input.cartItems.map((item) => item.dessertId) } },
        select: { id: true, priceInCents: true, promo: true },
      });

      const dbPriceMap = new Map(
        desserts.map((d) => {
          const discountedAmountInCents = d.promo
            ? d.promo.type === "FIXED_AMOUNT"
              ? d.promo.value
              : Math.floor(d.priceInCents * (d.promo.value / 100))
            : 0;
          return [d.id, d.priceInCents - discountedAmountInCents];
        }),
      );

      const mismatches = input.cartItems.filter((item) => {
        const dbPrice = dbPriceMap.get(item.dessertId);

        // dessert missing in DB or price mismatch
        return dbPrice === undefined || dbPrice !== item.priceInCentsAfterPromo;
      });

      const hasPriceChanged = mismatches.length > 0;
      return { hasPriceChanged };
    }),

  getCategories: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.category.findMany({
      select: {
        id: true,
        name: true,
      },
    });
  }),

  getIngredients: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.ingredient.findMany({});
  }),
});
