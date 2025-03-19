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
  const utils = api.useUtils();
  const changeStatus = api.order.changeStatus.useMutation({
    onSuccess: async () => {
      await utils.order.invalidate();
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
      header: "Order Number",
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
      header: "Customer Name",
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
      header: "Desserts",
      cell: ({ row }) => {
        const desserts = row.original.desserts
          .map((dessert) => dessert.dessert.name)
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
            Amount
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
            Created
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
            Completed
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
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        return <div className="font-medium">{status}</div>;
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
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                className="bg-orange-500"
                onClick={() => handlePastOrderStatusChange(id, "PENDING")}
              >
                Change to PENDING
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setCustomerDetailsOpen({ id, open: true })}
              >
                View customer details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setOrderDetailsOpen({ id, open: true })}
              >
                View order details
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
