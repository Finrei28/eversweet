import { z } from "zod";
import {
  changeOrderStatusSchema,
  createOrderSchema,
} from "~/app/components/schemas";
import EmailOrderConfirmation from "~/email/orderConfirmation";
import { Resend } from "resend";

import { stripe } from "~/lib/stripe";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { getDashboardFigures } from "~/server/dashboard";
import { getCurrentOrders, getPastOrders } from "~/server/adminOrders";
import { changeOrderStatus } from "~/server/orderStatusChange";
import { announceOrder } from "~/server/notifyAdmin";
import { followUpStillDue, placeWebsiteOrder } from "~/server/websiteOrder";

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

      // Past this point the order is committed and the card has been charged.
      // Neither of these may fail the mutation: the customer would be shown an
      // error for an order that exists, is paid for, and will be made. They
      // run together so the confirmation screen waits on the slower of the
      // two, not the sum of both.
      //
      // They run on a **retry** too - a call that finds the order already placed - rather
      // than returning early. A call that committed its order and then died, or lost its
      // answer on the way back, may never have reached this point, and nothing else would
      // ever send that customer their confirmation. Both steps are safe to repeat: the
      // announcement endpoint is idempotent, and the email carries an idempotency key, so
      // one that did go out is not sent twice.
      //
      // That key is only honoured for a day, though, and this mutation is public and takes a
      // client secret that never expires - so the repeat stops well inside it, or a checkout
      // resumed tomorrow would send a second confirmation. See `followUpStillDue`.
      if (!placedNow && !followUpStillDue(newOrder)) {
        return { ok: true as const, orderId: newOrder.id };
      }

      const [, confirmationEmail] = await Promise.allSettled([
        // Puts the order on the kitchen screen now, rather than leaving it for
        // the order server's cron to find within the next couple of minutes.
        announceOrder(newOrder.id),
        resend.emails.send(
          {
            from: '"Eversweet" <eversweet@eversweet.co.nz>',
            // The address the order was placed with, from the order itself, so a retry
            // sends exactly what the first attempt would have - Resend answers a reused
            // key whose message differs with an error rather than sending it.
            to: newOrder.customerEmail,
            subject: "Order Confirmation",
            react: EmailOrderConfirmation({ order: newOrder }),
          },
          // Sent as an `Idempotency-Key`: Resend hands back the first send's answer for 24
          // hours rather than sending again, which is what makes the retry above safe.
          { idempotencyKey: `order-confirmation:${newOrder.id}` },
        ),
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

  // Both lists are in ~/server/adminOrders, which says what each page holds and why.
  getAllCurrentOrders: protectedProcedure.query(({ ctx }) =>
    getCurrentOrders(ctx.db),
  ),

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
    .query(({ ctx, input }) => getPastOrders(ctx.db, input?.limit)),

  /**
   * For staff who forgot to move an order on the kitchen tablet. Through the order server,
   * never the database: see `changeOrderStatus`. A `changeStatus` here once wrote the status
   * straight to the database, so the tablets never heard and an order moved from the admin
   * pages could drop off every tablet's lists.
   *
   * `protectedProcedure` is the admin gate: customers cannot sign in to this site.
   */
  changeStatus: protectedProcedure
    .input(changeOrderStatusSchema)
    .mutation(({ input }) => changeOrderStatus(input)),

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

  /**
   * The admin dashboard's four figures, on the Auckland day, at what customers paid. One
   * call rather than the four it replaced, so the cards always agree on what "now" is. See
   * ~/server/dashboard.
   *
   * `protectedProcedure` is the admin gate: only an ADMIN can sign in on this website.
   */
  getDashboardFigures: protectedProcedure.query(({ ctx }) =>
    getDashboardFigures(ctx.db),
  ),
});
