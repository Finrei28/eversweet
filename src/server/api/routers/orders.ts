import { Status } from "@prisma/client";
import { z } from "zod";
import { createOrderSchema } from "~/app/components/schemas";
import EmailOrderConfirmation from "~/email/orderConfirmation";
import { Resend } from "resend";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

const resend = new Resend(process.env.RESEND_API_KEY);

export const orderRouter = createTRPCRouter({
  createNewOrder: publicProcedure
    .input(z.object({ orderData: createOrderSchema }))
    .mutation(async ({ ctx, input }) => {
      const { orderData } = input;

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize to midnight

      let counter = await ctx.db.tempOrderCounter.findUnique({
        where: { date: today },
      });

      if (!counter) {
        counter = await ctx.db.tempOrderCounter.create({
          data: {
            date: today,
            counter: 6000,
          },
        });
      } else {
        counter = await ctx.db.tempOrderCounter.update({
          where: { date: today },
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
          priceInCents: orderData.totalPriceInCents,
          GST: orderData.totalPriceInCents * 0.15, // GST in cents
          pickUpTime: orderData.pickUpTime,
          dineIn: false,
          status: "PENDING",
          paymentIntentId: orderData.paymentIntentId,
          desserts: {
            create: orderData.desserts.map((dessertItem) => ({
              dessert: {
                connect: {
                  id: dessertItem.dessert.id, // Ensure dessert exists before connecting
                },
              },

              quantity: dessertItem.dessert.quantity,
              priceInCents: dessertItem.priceInCents, // get price from order item
              discountedAmountInCents: dessertItem.discountedAmountInCents,
              promoId: dessertItem.promoId,
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
                  customisation: {
                    select: {
                      id: true,
                      name: true,
                      chineseName: true,
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

  getAllPastOrders: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.order.findMany({
      where: {
        OR: [
          { completedAt: { lt: new Date(Date.now() - 12 * 60 * 60 * 1000) } }, // Only include orders that have been completed more than 12 hours ago
          { pickedUpAt: { not: null } },
        ],
      },
      orderBy: [
        {
          completedAt: "asc", // Then sort by createdAt
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
          pickedUpAt: input.status === "PICKED_UP" ? new Date() : null,
          completedAt:
            input.status === "READY" || input.status === "PICKED_UP"
              ? new Date()
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
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0); // Set to 00:00:00 of today

    const endOfToday = new Date();
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
