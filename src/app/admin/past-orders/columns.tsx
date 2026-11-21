"use client";

import { ColumnDef } from "@tanstack/react-table";
import { formatCurrency, formatShortDate } from "~/lib/formatters";
import { paidInCents } from "~/lib/dashboard";
import { MoreHorizontal, ArrowUpDown } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useMemo } from "react";
import { OrderType } from "~/lib/types";
import { useLanguage } from "~/app/components/language";
import { orderStatusLabel } from "~/lib/orderStatus";
import {
  OrderStatusMenuItems,
  useChangeOrderStatus,
} from "~/app/admin/_components/orderStatusMenu";

type ColumnProps = {
  setCustomerDetailsOpen: React.Dispatch<
    React.SetStateAction<{
      id: string;
      open: boolean;
    }>
  >;
  setOrderDetailsOpen: React.Dispatch<
    React.SetStateAction<{
      id: string;
      open: boolean;
    }>
  >;
};

export function GetPastOrderColumns({
  setCustomerDetailsOpen,
  setOrderDetailsOpen,
}: ColumnProps): ColumnDef<OrderType>[] {
  const { language } = useLanguage();
  const changeStatus = useChangeOrderStatus();

  /**
   * Memoised on what the column definitions actually depend on.
   *
   * Without this, every render of the table rebuilds this array along with every inline
   * `cell`/`header` closure in it. `flexRender` calls those closures as components, so a
   * fresh identity is a *different component type* in the same position - React unmounts
   * the old cell and mounts a new one.
   *
   * Typing in the search box, sorting, paginating or a mutation settling was therefore
   * enough to tear down every Radix DropdownMenu in the table: any open menu closed, and
   * its `useId` was regenerated client-side.
   */
  return useMemo<ColumnDef<OrderType>[]>(
    () => [
      {
        accessorKey: "orderNumber",
        header: language === "en" ? "Order Number" : "订单号",
        cell: ({ row }) => {
          const orderNumber = row.original.tempOrderId;
          return <div className="font-medium">{orderNumber}</div>;
        },
        filterFn: (row, columnId, filterValue: string) => {
          const orderNumber = row.original.tempOrderId;
          return orderNumber.startsWith(filterValue);
        },
      },
      {
        accessorKey: "customer",
        header: language === "en" ? "Customer" : "顾客",
        cell: ({ row }) => {
          const firstName = row.original.customerFirstName;
          const lastName = row.original.customerLastName;
          return (
            <div className="font-medium">
              {firstName} {lastName}
            </div>
          );
        },
        filterFn: (row, columnId, filterValue: string) => {
          const firstName = row.original.customerFirstName.toLowerCase();
          const lastName = row.original.customerLastName.toLowerCase();
          const fullName = `${firstName} ${lastName}`;

          return fullName.includes(filterValue.toLowerCase());
        },
      },

      {
        accessorKey: "desserts",
        header: language === "en" ? "Desserts" : "甜点",
        cell: ({ row }) => {
          const desserts = row.original.desserts
            .map(
              (dessert) =>
                `${language === "en" ? dessert.dessert.name : dessert.dessert.chineseName}(${dessert.quantity})`,
            )
            .join(", ");
          return <div className="font-medium">{desserts}</div>;
        },
      },
      {
        // What the customer paid, and sorted by it. `priceInCents` alone is an app order's
        // price before its discounts - see `paidInCents`.
        id: "paid",
        accessorFn: paidInCents,
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            >
              {language === "en" ? "Paid" : "实付金额"}
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ getValue }) => (
          <div className="font-medium">
            {formatCurrency(getValue<number>() / 100)}
          </div>
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            >
              {language === "en" ? "Created" : "创建时间"}
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => {
          const createdAt = row.original.createdAt;
          const formatted = formatShortDate(createdAt);
          return <div className="font-medium">{formatted}</div>;
        },
      },
      {
        // Sorted by the date it shows. With `accessorKey: "completedAt"` a cancelled order
        // showed its cancellation but sorted by a completion date it may never have had
        // (Greptile on #37). The id stays `completedAt`, so anything keyed on it still finds it.
        id: "completedAt",
        accessorFn: (order) =>
          order.status === "CANCELLED" ? order.cancelledAt : order.completedAt,
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            >
              {language === "en" ? "Completed" : "完成时间"}
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => {
          // A cancelled order is finished with when it was cancelled; one
          // cancelled before it was ready has no completion date at all.
          const completedAt =
            row.original.status === "CANCELLED"
              ? row.original.cancelledAt
              : row.original.completedAt;
          const formatted = completedAt ? formatShortDate(completedAt) : null;
          return (
            <div className="font-medium">{formatted ? formatted : "-"}</div>
          );
        },
      },
      {
        accessorKey: "completed",
        header: language === "en" ? "Status" : "状态",
        cell: ({ row }) => (
          <div className="font-medium">
            {orderStatusLabel(row.original.status, language)}
          </div>
        ),
      },
      {
        // An order's details, then its status, for staff who forgot to move it on the tablet:
        // through the order server, so every tablet re-reads its lists. This menu once wrote
        // the status straight to the database, and an order moved that way could appear on no
        // tablet list at all. See `OrderStatusMenuItems`.
        id: "actions",
        cell: ({ row }) => {
          const id = row.original.id;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">
                    {language === "en" ? "Open menu" : "打开菜单"}
                  </span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {language === "en" ? "Action" : "行动"}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => setCustomerDetailsOpen({ id, open: true })}
                >
                  {language === "en" ? "View customer details" : "查看顾客详情"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setOrderDetailsOpen({ id, open: true })}
                >
                  {language === "en" ? "View order details" : "查看订单详情"}
                </DropdownMenuItem>
                <OrderStatusMenuItems
                  order={row.original}
                  changeStatus={changeStatus}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [language, changeStatus, setCustomerDetailsOpen, setOrderDetailsOpen],
  );
}
