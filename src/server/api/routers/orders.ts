import { Status } from "@prisma/client";
import { z } from "zod";
import { createOrderSchema } from "~/app/components/schemas";
import EmailOrderConfirmation from "~/email/orderConfirmation";
import { Resend } from "resend";

import { stripe } from "~/lib/stripe";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { announceOrder } from "~/server/notifyAdmin";
import { placeWebsiteOrder } from "~/server/websiteOrder";

const resend = new Resend(process.env.RESEND_API_KEY);

export const orderRouter = createTRPCRouter({
  /**
   * Places the order a website payment pays for, and takes the money. The payment is checked
   * against the order first - its status, and that the amount held is what the cart costs -
   * and a refusal comes back as a result, for the checkout to word. See ~/server/websiteOrder.
   */
  createNewOrder: publicProcedure
    .input(z.object({ orderData: createOrderSchema }))
    .mutation(async ({ ctx, input }) => {
      const { orderData } = input;

      const placed = await placeWebsiteOrder(ctx.db, stripe, orderData);

      if (!placed.ok) return placed;

      const { order: newOrder, placedNow } = placed;

      // A retry of a call that already placed this order. The kitchen and the customer
      // were told the first time.
      if (!placedNow) return { ok: true as const, orderId: newOrder.id };

      // Past this point the order is committed and the card has been charged.
      // Neither of these may fail the mutation: the customer would be shown an
      // error for an order that exists, is paid for, and will be made. They
      // run together so the confirmation screen waits on the slower of the
      // two, not the sum of both.
      const [, confirmationEmail] = await Promise.allSettled([
        // Puts the order on the kitchen screen now, rather than leaving it for
        // the order server's cron to find within the next couple of minutes.
        announceOrder(newOrder.id),
        resend.emails.send({
          from: '"Eversweet" <eversweet@eversweet.co.nz>',
          to: orderData.customerEmail,
          subject: "Order Confirmation",
          react: EmailOrderConfirmation({ order: newOrder }),
        }),
      ]);

      // Resend reports a refused send in the response rather than by throwing,
      // so both shapes have to be checked to notice a missing email.
      if (confirmationEmail.status === "rejected") {
        console.error(
          `Order ${newOrder.id}: confirmation email failed.`,
          confirmationEmail.reason,
        );
      } else if (confirmationEmail.value.error) {
        console.error(
          `Order ${newOrder.id}: confirmation email was refused.`,
          confirmationEmail.value.error,
        );
      }

      return { ok: true as const, orderId: newOrder.id };
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
