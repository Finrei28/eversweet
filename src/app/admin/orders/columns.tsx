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

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.

export type Order = {
  id: string;
  priceInCents: number;
  createdAt: Date;
  desserts: {}[];
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhoneNumber: number;
  completedAt: Date | null;
  completed: boolean;
};

export const columns: ColumnDef<Order>[] = [
  {
    accessorKey: "id",
    header: "Order Id",
    cell: ({ row }) => {
      const id = row.original.id;
      return <div className="font-medium">{id}</div>;
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
    filterFn: (row, columnId, filterValue) => {
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
      const desserts = (row.getValue("desserts") as any[])
        .map((dessert) => dessert.name)
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
      const amount = parseFloat(row.getValue("priceInCents"));
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
    accessorKey: "completed",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.completed;
      return (
        <div className="font-medium">
          {status === true ? "Completed" : "Pending"}
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: () => {
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
            <DropdownMenuSeparator />
            <DropdownMenuItem>View customer details</DropdownMenuItem>
            <DropdownMenuItem>View order details</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
