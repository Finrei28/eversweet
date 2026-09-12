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
import { useCallback, useMemo, useState } from "react";

import { useLanguage } from "~/app/components/language";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { toast } from "~/hooks/use-toast";
import { api } from "~/trpc/react";
import { GetOfferColumns, type OfferRow } from "./columns";
import ConfirmDialog from "./_components/confirmDialog";
import OfferDialog from "./_components/offerDialog";

/**
 * Actions that need confirming before they run.
 *
 * Activate and deactivate are absent on purpose: neither touches redemptions any more, so
 * both are reversible and go straight through. Only closing a run destroys anything.
 */
type PendingAction =
  | { kind: "closeRun"; offer: OfferRow }
  | { kind: "archive"; offer: OfferRow; archived: boolean };

export function DataTable() {
  const { language } = useLanguage();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [searchValue, setSearchValue] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const [editing, setEditing] = useState<{
    open: boolean;
    offer: OfferRow | null;
  }>({ open: false, offer: null });
  const [pending, setPending] = useState<PendingAction | null>(null);

  // Archived rows come down with everything else and are filtered here, so the toggle
  // is instant rather than a refetch.
  const [offers] = api.offer.getOffers.useSuspenseQuery();
  const utils = api.useUtils();

  const setActive = api.offer.setActive.useMutation({
    onSuccess: async (data) => {
      await utils.offer.invalidate();
      setPending(null);
      toast({
        title: language === "en" ? "Offer updated" : "优惠已更新",
        description:
          language === "en"
            ? `${data.name} has been updated.`
            : `${data.name} 已更新。`,
      });
    },
    onError: (error) => {
      setPending(null);
      toast({ variant: "destructive", title: error.message });
    },
  });

  const closeRun = api.offer.closeRun.useMutation({
    onSuccess: async (data) => {
      await utils.offer.invalidate();
      setPending(null);
      toast({
        title: language === "en" ? "Run closed" : "活动已结束",
        description:
          language === "en"
            ? `${data.name} is switched off and its end date cleared. ${data.redemptionsCleared} redemption record(s) removed — set new dates and activate it to start a fresh run.`
            : `${data.name} 已停用并清除结束日期，已移除 ${data.redemptionsCleared} 条兑换记录。设置新日期并启用即可开始新一轮。`,
      });
    },
    onError: (error) => {
      setPending(null);
      toast({ variant: "destructive", title: error.message });
    },
  });

  const setArchived = api.offer.setArchived.useMutation({
    onSuccess: async (data) => {
      await utils.offer.invalidate();
      setPending(null);
      toast({
        title: language === "en" ? "Offer updated" : "优惠已更新",
        description:
          language === "en"
            ? `${data.name} has been updated.`
            : `${data.name} 已更新。`,
      });
    },
    onError: (error) => {
      setPending(null);
      toast({ variant: "destructive", title: error.message });
    },
  });

  /**
   * Stable handlers, so the memoised column definitions actually stay memoised.
   *
   * `mutate` is pulled out of the mutation rather than used through it: the mutation
   * object gets a new identity every time its own state changes, which would invalidate
   * these on each call and rebuild every column. `mutate` itself is stable, and the
   * setState dispatchers always are.
   */
  const { mutate: mutateSetActive } = setActive;

  const handleEdit = useCallback(
    (offer: OfferRow) => setEditing({ open: true, offer }),
    [],
  );

  // Both directions are reversible and leave redemptions alone, so neither is confirmed.
  const handleSetActive = useCallback(
    (offer: OfferRow, active: boolean) =>
      mutateSetActive({ id: offer.id, active }),
    [mutateSetActive],
  );

  const handleSetArchived = useCallback(
    (offer: OfferRow, archived: boolean) =>
      setPending({ kind: "archive", offer, archived }),
    [],
  );

  const handleCloseRun = useCallback(
    (offer: OfferRow) => setPending({ kind: "closeRun", offer }),
    [],
  );

  const columns = GetOfferColumns({
    onEdit: handleEdit,
    onSetActive: handleSetActive,
    onSetArchived: handleSetArchived,
    onCloseRun: handleCloseRun,
  });

  /**
   * Memoised, and it has to be: `useReactTable` must not be handed a new `data`
   * identity on every render.
   *
   * TanStack Table's autoResetPageIndex watches `data` by reference. An unmemoised
   * `.filter()` here produced a fresh array each render, so the table reset its page
   * index, which set state, which re-rendered, which built another new array - an
   * infinite loop that pegged the main thread and froze the tab the moment anything
   * caused a second render (opening the new-offer dialog was enough).
   *
   * The other admin tables pass their query result straight through, so they never hit
   * this. This one derives a filtered view, which is exactly the case that needs the
   * memo.
   */
  const data = useMemo(
    () =>
      showArchived
        ? offers
        : offers.filter((offer) => offer.archivedAt === null),
    [offers, showArchived],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: { sorting, columnFilters },
  });

  const confirmCopy = (() => {
    if (!pending) return null;

    if (pending.kind === "closeRun") {
      const count = pending.offer._count.redemptions;
      const gated = pending.offer.requirements.length > 0;

      return {
        title: language === "en" ? "Close this run?" : "结束此轮活动？",
        description:
          language === "en"
            ? [
                `"${pending.offer.name}" will be switched off and its end date cleared, so you can set new dates.`,
                count > 0
                  ? `${count} redemption record(s) will be deleted permanently.`
                  : "It has no redemption records to delete.",
                gated && count > 0
                  ? "Customers who unlocked this offer will have to qualify for it again, and anyone holding an unused unlock will lose it."
                  : "",
              ]
                .filter(Boolean)
                .join(" ")
            : [
                `「${pending.offer.name}」将被停用并清除结束日期，之后可设置新日期。`,
                count > 0
                  ? `将永久删除 ${count} 条兑换记录。`
                  : "没有需要删除的兑换记录。",
                gated && count > 0
                  ? "已解锁此优惠的顾客需要重新达成条件，尚未使用的解锁也会失效。"
                  : "",
              ]
                .filter(Boolean)
                .join(""),
        confirmLabel: language === "en" ? "Close run" : "结束此轮活动",
        destructive: count > 0,
      };
    }

    return {
      title: pending.archived
        ? language === "en"
          ? "Archive offer?"
          : "封存优惠？"
        : language === "en"
          ? "Restore offer?"
          : "还原优惠？",
      description: pending.archived
        ? language === "en"
          ? `"${pending.offer.name}" will be switched off and hidden from this list. Its history is kept — offers are never deleted.`
          : `「${pending.offer.name}」将被停用并从列表中隐藏。记录会保留 — 优惠不会被删除。`
        : language === "en"
          ? `"${pending.offer.name}" will come back paused. Activate it separately when it is ready to run.`
          : `「${pending.offer.name}」将以停用状态还原，准备好后再单独启用。`,
      confirmLabel: pending.archived
        ? language === "en"
          ? "Archive"
          : "封存"
        : language === "en"
          ? "Restore"
          : "还原",
      destructive: pending.archived,
    };
  })();

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 py-4">
        <Input
          placeholder={
            language === "en" ? "Search by offer name" : "按优惠名称搜索"
          }
          value={searchValue}
          onChange={(event) => {
            const value = event.target.value;
            setSearchValue(value);
            table.getColumn("name")?.setFilterValue(value);
          }}
          className="max-w-sm border-black"
        />

        <div className="flex items-center gap-2">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} />
          <span className="text-sm">
            {language === "en" ? "Show archived" : "显示已封存"}
          </span>
        </div>

        <Button
          className="ml-auto"
          onClick={() => setEditing({ open: true, offer: null })}
        >
          {language === "en" ? "New offer" : "新增优惠"}
        </Button>
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
                  {language === "en" ? "No offers yet." : "暂无优惠。"}
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

      <OfferDialog
        open={editing.open}
        onOpenChange={(open) => {
          setEditing((prev) => ({ ...prev, open }));
        }}
        offer={editing.offer}
      />

      {pending && confirmCopy && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPending(null)}
          title={confirmCopy.title}
          description={confirmCopy.description}
          confirmLabel={confirmCopy.confirmLabel}
          destructive={confirmCopy.destructive}
          loading={closeRun.isPending || setArchived.isPending}
          onConfirm={() => {
            if (pending.kind === "closeRun") {
              closeRun.mutate({ id: pending.offer.id });
            } else {
              setArchived.mutate({
                id: pending.offer.id,
                archived: pending.archived,
              });
            }
          }}
        />
      )}
    </div>
  );
}
