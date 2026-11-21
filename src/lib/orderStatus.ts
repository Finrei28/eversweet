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
