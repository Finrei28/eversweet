import { z } from "zod";
import { orderSchema } from "~/app/components/schemas";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const orderRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      z.object({
        dessert: z.array(orderSchema),
        customerFirstName: z.string().min(1),
        customerLastName: z.string().min(1),
        customerEmail: z.string().email(),
        customerPhoneNumber: z.string().min(10).max(15),
        totalPriceInCents: z.coerce.number().int().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.order.create({
        data: {
          tempOrderId: String(Math.floor(Math.random() * 10000)),
          customerFirstName: input.customerFirstName,
          customerLastName: input.customerLastName,
          customerEmail: input.customerEmail,
          customerPhoneNumber: Number(input.customerPhoneNumber),
          priceInCents: input.totalPriceInCents,
          status: "PENDING",
          desserts: {
            create: input.dessert.map((dessertItem) => ({
              dessert: { connect: { id: dessertItem.dessert.id } },
              quantity: dessertItem.dessert.quantity,
              customisations: {
                create: dessertItem.customisations.map(
                  (customisationsItem) => ({
                    customisation: {
                      connect: { id: customisationsItem.id },
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
              customisations: { include: { customisation: true } },
            },
          },
        },
      });
    }),

  getOrder: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.order.findFirst({
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

  getAllOrders: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.order.findMany();
  }),

  getPendingOrders: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.order.findMany({ where: { status: "PENDING" } });
  }),
});
