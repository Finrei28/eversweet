"use client";

import type { Status } from "@prisma/client";
import { useCallback, useRef } from "react";

import { useLanguage } from "~/app/components/language";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import { toast } from "~/hooks/use-toast";
import {
  isStaffStatus,
  orderStatusLabel,
  type StaffStatus,
  statusChangeNotice,
  statusChoices,
} from "~/lib/orderStatus";
import { api } from "~/trpc/react";

type MovableOrder = { id: string; tempOrderId: string; status: Status };

export type ChangeOrderStatus = (
  order: MovableOrder,
  newStatus: StaffStatus,
) => void;

/**
 * Moves an order's status through the order server, from the status its row shows, and says
 * how it went. Stable, so the columns' `useMemo` keeps it.
 *
 * The Orders and Past Orders tables share it: an order moved back from collected leaves one
 * for the other, and the refetch moves it.
 */
export function useChangeOrderStatus(): ChangeOrderStatus {
  const { language } = useLanguage();
  const utils = api.useUtils();
  // Each order's number, for the toast: one mutation serves every row, and its callbacks are
  // told only the order's id.
  const orderNumbers = useRef(new Map<string, string>());

  const { mutate } = api.order.changeStatus.useMutation({
    onSuccess: async (result, change) => {
      const orderNumber = orderNumbers.current.get(change.orderId) ?? "";
      await utils.order.invalidate();
      toast(
        statusChangeNotice(language, orderNumber, change.newStatus, result),
      );
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title:
          language === "en" ? "Couldn't change the status" : "无法更改状态",
        description: error.message,
      });
    },
  });

  return useCallback(
    (order, newStatus) => {
      if (!isStaffStatus(order.status)) return;
      orderNumbers.current.set(order.id, order.tempOrderId);
      mutate({ orderId: order.id, newStatus, expectedStatus: order.status });
    },
    [mutate],
  );
}

/**
 * The status half of an order's row menu: the kitchen tablet's Update Status set, and nothing
 * until a tablet has accepted the order - accepting prints its receipt on the tablet that
 * accepts. Never Cancel, which stays on the tablets. See `statusChoices`.
 */
export function OrderStatusMenuItems({
  order,
  changeStatus,
}: {
  order: MovableOrder;
  changeStatus: ChangeOrderStatus;
}) {
  const { language } = useLanguage();
  const choices = statusChoices(order.status);
  if (choices.length === 0) return null;

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>
        {language === "en" ? "Change status" : "更改状态"}
      </DropdownMenuLabel>
      {choices.map((choice) => (
        <DropdownMenuItem
          key={choice}
          onClick={() => changeStatus(order, choice)}
        >
          {orderStatusLabel(choice, language)}
        </DropdownMenuItem>
      ))}
    </>
  );
}
