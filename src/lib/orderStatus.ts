import type { Status } from "@prisma/client";

/**
 * Every status in Chinese. A `Record` over the enum, so a status added to the schema does not
 * compile until it has a name here.
 *
 * The admin tables wrote PENDING, READY and CANCELLED in Chinese and called anything else
 * 已取货 (picked up), so an order a kitchen tablet had accepted, or was making, read as
 * collected.
 */
const CHINESE: Record<Status, string> = {
  PENDING: "待处理",
  ACCEPTED: "已接单",
  MAKING: "制作中",
  READY: "已完成",
  PICKED_UP: "已取货",
  CANCELLED: "已取消",
};

/** An order's status for the admin tables: the status itself in English, as they always had. */
export const orderStatusLabel = (status: Status, language: "en" | "zh") =>
  language === "en" ? status : CHINESE[status];

/**
 * The statuses an admin can move an order between from the Orders and Past Orders tables: the
 * kitchen tablet's Update Status set (the owner's choice, 2026-11-21). The order server's
 * `PUT /api/internal/orders/status` holds the same list and refuses anything else.
 *
 * - Not PENDING, and not out of it: accepting prints the order's receipt on the tablet that
 *   accepts, so an order accepted here would reach the kitchen with nothing printed.
 * - Not CANCELLED: cancelling is final, takes back the order's points, and stays on the
 *   tablets.
 */
export const STAFF_STATUSES = [
  "ACCEPTED",
  "MAKING",
  "READY",
  "PICKED_UP",
] as const satisfies readonly Status[];

export type StaffStatus = (typeof STAFF_STATUSES)[number];

export const isStaffStatus = (status: Status): status is StaffStatus =>
  (STAFF_STATUSES as readonly Status[]).includes(status);

/** What an order's row menu offers to move it to: none until a tablet has accepted it. */
export const statusChoices = (status: Status): StaffStatus[] =>
  isStaffStatus(status) ? STAFF_STATUSES.filter((s) => s !== status) : [];

export type StatusChangeNotice = {
  title: string;
  description?: string;
  variant: "default" | "destructive";
};

/**
 * The toast once the order server has answered a status change. `status` is where the order
 * is now. A `changed` answer whose status is the one asked for is a retry of a change that
 * went through, so it reads as done.
 */
export const statusChangeNotice = (
  language: "en" | "zh",
  orderNumber: string,
  asked: StaffStatus,
  result: { outcome: "moved" | "changed"; status: Status },
): StatusChangeNotice => {
  const name = (status: Status) => orderStatusLabel(status, language);

  if (result.status === asked) {
    return {
      variant: "default",
      title:
        language === "en"
          ? `Order #${orderNumber} is now ${name(asked)}`
          : `订单 #${orderNumber} 已改为${name(asked)}`,
    };
  }

  if (result.status === "CANCELLED") {
    return {
      variant: "destructive",
      title:
        language === "en"
          ? `Order #${orderNumber} has been cancelled`
          : `订单 #${orderNumber} 已取消`,
      description:
        language === "en"
          ? "Its status can no longer be changed."
          : "无法再更改状态。",
    };
  }

  return {
    variant: "destructive",
    title:
      language === "en"
        ? `Order #${orderNumber} was changed elsewhere`
        : `订单 #${orderNumber} 已在别处更改`,
    description:
      language === "en"
        ? `It is now ${name(result.status)}, so nothing was changed. Check it and try again if you need to.`
        : `现在是${name(result.status)}，未作更改。如有需要，请核对后再试。`,
  };
};
