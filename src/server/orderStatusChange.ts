import "server-only";

import { Status } from "@prisma/client";
import { z } from "zod";

import type { changeOrderStatusSchema } from "~/app/components/schemas";
import { callOrderServer } from "./orderServer";

/**
 * What the order server says. `moved`: the order is now where it was asked to go. `changed`:
 * it was no longer in the status the table showed, so nothing was written, and `status` is
 * where it is now - for a retry of a call that committed, the status asked for.
 */
const statusChangeSchema = z.object({
  outcome: z.enum(["moved", "changed"]),
  status: z.nativeEnum(Status),
});

export type StatusChange = z.output<typeof statusChangeSchema>;

/**
 * Moves an order's status for staff who forgot to on the kitchen tablet, through the order
 * server - never the database. The order server tells every tablet to re-read its lists and
 * marks the order `notified`, as when a tablet moves it; this site used to write the status
 * itself, and an order moved that way could drop off every tablet's lists. It pushes the
 * customer nothing: the owner's choice, since a change made here is usually a late fix.
 *
 * Lives here rather than in the orders router so Vitest can load it (see Testing a router in
 * CLAUDE.md).
 */
export const changeOrderStatus = (
  change: z.output<typeof changeOrderStatusSchema>,
): Promise<StatusChange> =>
  callOrderServer(
    "PUT",
    "/api/internal/orders/status",
    {
      orderId: change.orderId,
      newStatus: change.newStatus,
      expectedStatus: change.expectedStatus,
    },
    statusChangeSchema,
  );
