import { Status } from "@prisma/client";
import { z } from "zod";
import { orderSchema } from "~/app/components/schemas";
import EmailOrderConfirmation from "~/email/orderConfirmation";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY as string);

export const orderRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      z.object({
        dessert: z.array(orderSchema),
        customerFirstName: z.string().min(1),
        customerLastName: z.string().min(1),
        customerEmail: z.string().email(),
        customerPhoneNumber: z.string().nullable(),
        totalPriceInCents: z.coerce.number().int().min(1),
        pickUpTime: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.db.order.create({
        data: {
          tempOrderId: String(Math.floor(Math.random() * 100000)),
          customerFirstName: input.customerFirstName,
          customerLastName: input.customerLastName,
          customerEmail: input.customerEmail,
          customerPhoneNumber: input.customerPhoneNumber,
          priceInCents: input.totalPriceInCents,
          pickUpTime: input.pickUpTime,
          status: "PENDING",
          desserts: {
            create: input.dessert.map((dessertItem) => ({
              dessert: {
                connect: {
                  id: dessertItem.dessert.id, // Ensure dessert exists before connecting
                },
              },
              quantity: dessertItem.dessert.quantity,
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
        include: {
          desserts: {
            include: {
              dessert: true,
              customisations: {
                include: { customisation: true },
              },
            },
          },
        },
      });

      await resend.emails.send({
        from: '"Eversweet" <eversweet@eversweet.co.nz>',
        to: input.customerEmail,
        subject: "Order Confirmation",
        react: EmailOrderConfirmation({ order }),
      });

      return order;
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
      where: {
        status: { in: ["PENDING", "COMPLETED"] },
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
      return await ctx.db.order.update({
        where: { id: input.id },
        data: {
          status: input.status as Status,
          pickedUpAt: input.status === "PICKED_UP" ? new Date() : null,
          completedAt:
            input.status === "COMPLETED" || input.status === "PICKED_UP"
              ? new Date()
              : input.status === "PENDING"
                ? null
                : undefined,
        },
      });
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

  // getFirstOrder: publicProcedure.query(async ({ ctx }) => {
  //   const order = await ctx.db.order.findFirst({
  //     include: {
  //       desserts: {
  //         include: {
  //           dessert: true,
  //           customisations: {
  //             include: { customisation: true },
  //           },
  //         },
  //       },
  //     },
  //   });
  //   if (!order) {
  //     return;
  //   }
  //   resend.emails.send({
  //     from: "eversweet@eversweet.co.nz",
  //     to: order.customerEmail,
  //     subject: "Order Confirmation",
  //     react: EmailOrderConfirmation({ order }),
  //   });
  //   return order;
  // }),
});
