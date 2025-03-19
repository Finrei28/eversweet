"use client";

import * as React from "react";
import {
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "~/components/ui/button";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Input } from "~/components/ui/input";
import { GetOrderColumns } from "./columns";
import { api } from "~/trpc/react";
import { useState } from "react";
import CustomerDetails from "./_components/customerDetails";
import OrderDetails from "./_components/orderDetails";

export function DataTable() {
  const [customerDetailsOpen, setCustomerDetailsOpen] = useState({
    id: "",
    open: false,
  });
  const [orderDetailsOpen, setOrderDetailsOpen] = useState({
    id: "",
    open: false,
  });
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );

  const columns = GetOrderColumns({
    setCustomerDetailsOpen,
    setOrderDetailsOpen,
  });
  const [data] = api.order.getAllCurrentOrders.useSuspenseQuery();

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  });

  const [searchValue, setSearchValue] = React.useState("");

  const handleChangeOpen = () => {
    setCustomerDetailsOpen({ id: "", open: false });
    setOrderDetailsOpen({ id: "", open: false });
  };

  return (
    <div>
      <div className="flex items-center py-4">
        <Input
          placeholder="Search by customer or Order number"
          value={searchValue}
          onChange={(event) => {
            const value = event.target.value;
            setSearchValue(value); // Update local state

            if (isNaN(Number(value))) {
              // If it's a name (non-numeric)
              table.getColumn("customer")?.setFilterValue(value);
              table.getColumn("orderNumber")?.setFilterValue(""); // Clear orderNumber filter
            } else if (!value) {
              // if no value
              table.getColumn("orderNumber")?.setFilterValue("");
              table.getColumn("customer")?.setFilterValue(""); // Clear customer filter
            } else {
              // If it's an order number (numeric)
              table.getColumn("orderNumber")?.setFilterValue(Number(value));
              table.getColumn("customer")?.setFilterValue(""); // Clear customer filter
            }
          }}
          className="max-w-sm border-black"
        />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const customisationsExist = row.original.desserts.some(
                  (dessert) => dessert.customisations.length > 0,
                );
                const status = row.original.status;
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={`${status === "COMPLETED" ? "bg-green-500" : status === "PICKED_UP" ? "bg-red-500" : customisationsExist ? "bg-orange-200" : ""}`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No new orders.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>

        {customerDetailsOpen && (
          <CustomerDetails
            customerDetailsOpen={customerDetailsOpen}
            handleChangeOpen={handleChangeOpen}
          />
        )}
        {orderDetailsOpen && (
          <OrderDetails
            orderDetailsOpen={orderDetailsOpen}
            handleChangeOpen={handleChangeOpen}
          />
        )}
      </div>
    </div>
  );
}
