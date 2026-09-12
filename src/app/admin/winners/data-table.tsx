"use client";

import {
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useCallback, useState } from "react";

import { useLanguage } from "~/app/components/language";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { api } from "~/trpc/react";
import { GetWinnerColumns, type WinnerRow } from "./columns";
import RewardDialog from "./_components/rewardDialog";

/**
 * Monthly winners, newest first. There is no "add winner" control: the rows are written
 * by settleMonthlyWinners on the order server when it closes a month, so an empty table
 * is the normal state until the first month settles rather than a sign of a problem.
 */
export function DataTable() {
  const { language } = useLanguage();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [searchValue, setSearchValue] = useState("");
  const [editing, setEditing] = useState<{
    open: boolean;
    winner: WinnerRow | null;
  }>({ open: false, winner: null });

  const [winners] = api.winner.getWinners.useSuspenseQuery();

  // Stable, so the memoised column definitions actually stay memoised - setEditing is
  // a setState dispatcher and never changes identity.
  const handleEditReward = useCallback(
    (winner: WinnerRow) => setEditing({ open: true, winner }),
    [],
  );

  const columns = GetWinnerColumns({ onEditReward: handleEditReward });

  const table = useReactTable({
    data: winners,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: { sorting, columnFilters },
  });

  return (
    <div>
      <div className="flex items-center py-4">
        <Input
          placeholder={
            language === "en" ? "Search by winner name" : "按得奖者姓名搜索"
          }
          value={searchValue}
          onChange={(event) => {
            const value = event.target.value;
            setSearchValue(value);
            table.getColumn("winner")?.setFilterValue(value);
          }}
          className="max-w-sm border-black"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {language === "en" ? "No winners yet." : "暂无得奖者。"}
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
      </div>

      <RewardDialog
        open={editing.open}
        onOpenChange={(open) => setEditing((prev) => ({ ...prev, open }))}
        winner={editing.winner}
      />
    </div>
  );
}
