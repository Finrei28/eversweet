"use client";

import { ColumnDef } from "@tanstack/react-table";
import { formatCurrency } from "~/lib/formatters";
import { MoreHorizontal, ArrowUpDown } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { api } from "~/trpc/react";
import { useCallback } from "react";
import { OrderType } from "~/app/components/types";
import { useLanguage } from "~/app/components/language";

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
  const utils = api.useUtils();
  const changeStatus = api.order.changeStatus.useMutation({
    onSuccess: async () => {
      await utils.order.getAllPastOrders.invalidate();
    },
  });

  const handlePastOrderStatusChange = useCallback(
    (id: string, status: string) => {
      changeStatus.mutate({ id, status });
    },
    [changeStatus],
  );
  return [
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
      accessorKey: "priceInCents",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {language === "en" ? "Amount" : "价格"}
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("priceInCents")) / 100;
        const formatted = formatCurrency(amount);
        return <div className="font-medium">{formatted}</div>;
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {language === "en" ? "Created" : "创建时间"}
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const createdAt = row.original.createdAt;
        const formatted = new Intl.DateTimeFormat("en-NZ").format(createdAt);
        return <div className="font-medium">{formatted}</div>;
      },
    },
    {
      accessorKey: "completedAt",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {language === "en" ? "Completed" : "完成时间"}
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const completedAt = row.original.completedAt;
        const formatted = completedAt
          ? new Intl.DateTimeFormat("en-NZ").format(completedAt)
          : null;
        return <div className="font-medium">{formatted ? formatted : "-"}</div>;
      },
    },
    {
      accessorKey: "completed",
      header: language === "en" ? "Status" : "状态",
      cell: ({ row }) => {
        const status = row.original.status;
        const chineseStatus =
          status === "PENDING"
            ? "待处理"
            : status === "COMPLETED"
              ? "已完成"
              : "已取货";
        return (
          <div className="font-medium">
            {language === "en" ? status : chineseStatus}
          </div>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const id = row.original.id;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                {language === "en" ? "Action" : "行动"}
              </DropdownMenuLabel>
              <DropdownMenuItem
                className="bg-orange-500"
                onClick={() => handlePastOrderStatusChange(id, "PENDING")}
              >
                {language === "en" ? "Change to PENDING" : "更改为待处理"}
              </DropdownMenuItem>

              <DropdownMenuSeparator />
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
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
