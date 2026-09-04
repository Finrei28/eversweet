import { TRPCError } from "@trpc/server";
import { Status } from "@prisma/client";
import { z } from "zod";
import { createOrderSchema } from "~/app/components/schemas";
import EmailOrderConfirmation from "~/email/orderConfirmation";
import { Resend } from "resend";
import { formatInTimeZone } from "date-fns-tz";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { getNowNZ } from "~/lib/pickUpTimeHelper";
import {
  CartPricingError,
  gstInCentsFromInclusiveTotal,
  priceCart,
} from "~/server/pricing";

const resend = new Resend(process.env.RESEND_API_KEY);

export const orderRouter = createTRPCRouter({
  createNewOrder: publicProcedure
    .input(z.object({ orderData: createOrderSchema }))
    .mutation(async ({ ctx, input }) => {
      const { orderData } = input;

      // Price the order from the database rather than trusting the amounts the
      // browser sent. Availability is not enforced here: payment has already
      // succeeded by this point, so an item selling out in the meantime must
      // not stop the order being recorded.
      let pricing;
      try {
        pricing = await priceCart(
          ctx.db,
          orderData.desserts.map((item) => ({
            dessertId: item.dessert.id,
            quantity: item.dessert.quantity,
            customisations: item.customisations.map((customisation) => ({
              id: customisation.id,
              quantity: customisation.quantity,
            })),
          })),
          { requireAvailable: false },
        );
      } catch (error) {
        if (error instanceof CartPricingError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        }
        throw error;
      }

      const pickUpNZDate = formatInTimeZone(
        new Date(orderData.pickUpTime),
        "Pacific/Auckland",
        "yyyy-MM-dd",
      );

      let counter = await ctx.db.tempOrderCounter.findUnique({
        where: { date: pickUpNZDate },
      });

      if (!counter) {
        counter = await ctx.db.tempOrderCounter.create({
          data: {
            date: pickUpNZDate,
            counter: 6000,
          },
        });
      } else {
        counter = await ctx.db.tempOrderCounter.update({
          where: { date: pickUpNZDate },
          data: { counter: counter.counter + 1 },
        });
      }

      const newOrder = await ctx.db.order.create({
        data: {
          tempOrderId: counter.counter.toString(),
          customerFirstName: orderData.customerFirstName ?? "",
          customerLastName: orderData.customerLastName ?? "",
          customerEmail: orderData.customerEmail,
          customerPhoneNumber: orderData.customerPhoneNumber,
          source: "WEBSITE",
          priceInCents: pricing.totalInCents,
          // main independently arrived at the same 3/23 formula. Kept here on
          // the server-priced total rather than the client's number, and
          // rounded because GST is an Int column.
          GST: gstInCentsFromInclusiveTotal(pricing.totalInCents),
          pickUpTime: orderData.pickUpTime,
          dineIn: false,
          status: "PENDING",
          paymentIntentId: orderData.paymentIntentId,
          desserts: {
            create: orderData.desserts.map((dessertItem, index) => ({
              dessert: {
                connect: {
                  id: dessertItem.dessert.id, // Ensure dessert exists before connecting
                },
              },

              quantity: dessertItem.dessert.quantity,
              // Server-priced, in the same order as the input lines.
              priceInCents: pricing.lines[index]!.unitPriceInCents,
              discountedAmountInCents:
                pricing.lines[index]!.discountedAmountInCents,
              promoId: pricing.lines[index]!.promoId,
              customisations: {
                create: dessertItem.customisations.map(
                  (customisationsItem) => ({
                    customisation: {
                      connect: {
                        id: customisationsItem.id, // Ensure customisation exists before connecting
                      },
                    },
                    quantity: customisationsItem.quantity,
                  }),
                ),
              },
            })),
          },
        },
        select: {
          id: true,
          tempOrderId: true,
          status: true,
          createdAt: true,
          customerFirstName: true,
          customerLastName: true,
          customerEmail: true,
          customerPhoneNumber: true,
          priceInCents: true,
          discountedAmountInCents: true,
          pickUpTime: true,
          dineIn: true,
          pickedUpAt: true,
          GST: true,
          notified: true,
          appUserId: true,
          desserts: {
            select: {
              orderId: true,
              id: true,
              quantity: true,
              priceInCents: true,
              discountedAmountInCents: true,
              dessert: {
                select: {
                  id: true,
                  name: true,
                  chineseName: true,
                  imagePath: true,
                },
              },
              customisations: {
                select: {
                  id: true,
                  quantity: true,
                  discountedAmountInCents: true,
                  customisation: {
                    select: {
                      id: true,
                      name: true,
                      chineseName: true,
                      priceInCents: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      await resend.emails.send({
        from: '"Eversweet" <eversweet@eversweet.co.nz>',
        to: orderData.customerEmail,
        subject: "Order Confirmation",
        react: EmailOrderConfirmation({ order: newOrder }),
      });
      return;
    }),

  getOrder: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return await ctx.db.order.findFirst({
        where: { id: input.id },
        include: {
          desserts: {
            include: {
              dessert: true,
              customisations: { include: { customisation: true } },
            },
          },
        },
      });
    }),

  findOrderWithPaymentIntentId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const order = await ctx.db.order.findFirst({
        where: { paymentIntentId: input.id },
        select: { id: true },
      });
      return order ? order.id : null;
    }),

  getAllCurrentOrders: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.order.findMany({
      relationLoadStrategy: "join",
      where: {
        status: { in: ["PENDING", "READY"] },
        pickUpTime: {
          lte: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
        },
        OR: [
          { completedAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) } }, // completed in the last 12 hours
          { completedAt: null },
        ],
        // Get only PENDING or COMPLETED orders
      },
      orderBy: [
        {
          status: "asc", // PENDING first (since "PENDING" < "COMPLETED" alphabetically)
        },
        {
          createdAt: "desc", // Then sort by createdAt
        },
      ],
      include: {
        desserts: {
          include: {
            dessert: {
              select: {
                id: true,
                name: true,
                chineseName: true,
              },
            },
            customisations: {
              include: { customisation: true },
            },
          },
        },
      },
    });
  }),

  getAllPastOrders: protectedProcedure
    .input(
      z
        .object({
          // The table filters, sorts and paginates on the client, so this is
          // the size of the window it works over - not a page size.
          limit: z.number().int().positive().max(2000).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db.order.findMany({
        relationLoadStrategy: "join",
        // Bounded: this used to fetch every order ever placed, with two levels
        // of nested includes, on every visit to the page.
        take: input?.limit ?? 500,
        where: {
          OR: [
            { completedAt: { lt: new Date(Date.now() - 12 * 60 * 60 * 1000) } }, // Only include orders that have been completed more than 12 hours ago
            { pickedUpAt: { not: null } },
          ],
        },
        orderBy: [
          {
            // Newest first, so `take` keeps the most recent orders rather than
            // the oldest ones.
            completedAt: "desc",
          },
        ],
        include: {
          desserts: {
            include: {
              dessert: {
                select: {
                  id: true,
                  name: true,
                  chineseName: true,
                },
              },
              customisations: {
                include: { customisation: true },
              },
            },
          },
        },
      });
    }),

  changeStatus: protectedProcedure
    .input(z.object({ id: z.string(), status: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.db.order.update({
        where: { id: input.id },
        data: {
          status: input.status as Status,
          pickedUpAt: input.status === "PICKED_UP" ? getNowNZ() : null,
          completedAt:
            input.status === "READY" || input.status === "PICKED_UP"
              ? getNowNZ()
              : input.status === "PENDING"
                ? null
                : undefined,
        },
      });
      return { orderId: order.tempOrderId, status: order.status };
    }),

  getCustomerDetails: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.order.findUnique({
        where: { id: input.id },
        select: {
          customerEmail: true,
          customerFirstName: true,
          customerLastName: true,
          customerPhoneNumber: true,
        },
      });
    }),

  getOrderDetails: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.order.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          tempOrderId: true,
          pickedUpAt: true,
          desserts: {
            include: {
              dessert: {
                select: {
                  id: true,
                  imagePath: true,
                  name: true,
                  chineseName: true,
                },
              },
              customisations: {
                include: {
                  customisation: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
          priceInCents: true,
        },
      });
    }),

  getCurrentOrders: protectedProcedure.query(async ({ ctx }) => {
    const Currentorders = await ctx.db.order.count({
      where: {
        status: "PENDING",
      },
    });
    return Currentorders;
  }),

  getCompletedOrders: protectedProcedure.query(async ({ ctx }) => {
    const CompletedOrders = await ctx.db.order.count({
      where: {
        completedAt: {
          not: null,
        },
      },
    });
    return CompletedOrders;
  }),

  getSalesToday: protectedProcedure.query(async ({ ctx }) => {
    const startOfToday = getNowNZ();
    startOfToday.setHours(0, 0, 0, 0); // Set to 00:00:00 of today

    const endOfToday = getNowNZ();
    endOfToday.setHours(23, 59, 59, 999); // Set to 23:59:59 of today

    const salesToday = await ctx.db.order.aggregate({
      _sum: { priceInCents: true },
      _count: true,
      where: {
        createdAt: {
          gte: startOfToday, // Orders from today 00:00:00 onwards
          lt: endOfToday, // Orders before tomorrow 00:00:00
        },
      },
    });

    return {
      amount: (salesToday._sum.priceInCents || 0) / 100,
      numberOfSales: salesToday._count,
    };
  }),

  getTotalSales: protectedProcedure.query(async ({ ctx }) => {
    const totalSales = await ctx.db.order.aggregate({
      _sum: { priceInCents: true },
      _count: true,
    });

    return {
      totalAmount: (totalSales._sum.priceInCents || 0) / 100,
      totalNumberOfSales: totalSales._count,
    };
  }),
});
