"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";

import { useLanguage } from "~/app/components/language";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { formatCurrency } from "~/lib/formatters";
import { hasEnded, offerState, type OfferState } from "~/lib/offers";
import { type RouterOutputs } from "~/trpc/react";

export type OfferRow = RouterOutputs["offer"]["getOffers"][number];

type ColumnProps = {
  onEdit: (offer: OfferRow) => void;
  onSetActive: (offer: OfferRow, active: boolean) => void;
  onSetArchived: (offer: OfferRow, archived: boolean) => void;
  onCloseRun: (offer: OfferRow) => void;
};

/**
 * Pinned to Auckland. Without a zone the cell renders in UTC on the server and in the
 * browser's zone after hydration, and a start date - midnight in Auckland - is the day
 * before in UTC, so the two renders disagreed.
 */
const dateFormatter = new Intl.DateTimeFormat("en-NZ", {
  timeZone: "Pacific/Auckland",
});

const STATE_LABELS: Record<OfferState, { en: string; zh: string }> = {
  LIVE: { en: "Live", zh: "进行中" },
  SCHEDULED: { en: "Scheduled", zh: "已排程" },
  PAUSED: { en: "Paused", zh: "已暂停" },
  ENDED: { en: "Ended", zh: "已结束" },
  ARCHIVED: { en: "Archived", zh: "已封存" },
};

/** Only a live offer earns the solid badge; everything else is visibly not running. */
const STATE_VARIANTS: Record<OfferState, "default" | "secondary" | "outline"> =
  {
    LIVE: "default",
    SCHEDULED: "secondary",
    PAUSED: "secondary",
    ENDED: "outline",
    ARCHIVED: "outline",
  };

export function GetOfferColumns({
  onEdit,
  onSetActive,
  onSetArchived,
  onCloseRun,
}: ColumnProps): ColumnDef<OfferRow>[] {
  const { language } = useLanguage();

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
  return useMemo<ColumnDef<OfferRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: language === "en" ? "Offer" : "优惠",
        cell: ({ row }) => {
          const { name, image } = row.original;
          return (
            <div className="flex items-center gap-3">
              {image ? (
                <Image
                  src={image}
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded object-cover"
                />
              ) : (
                <div className="h-8 w-8 shrink-0 rounded bg-muted" />
              )}
              <span className="font-medium">{name}</span>
            </div>
          );
        },
        filterFn: (row, _columnId, filterValue: string) =>
          row.original.name.toLowerCase().includes(filterValue.toLowerCase()),
      },
      {
        id: "status",
        header: language === "en" ? "Status" : "状态",
        // Derived rather than stored, so the badge is computed against a fresh clock
        // every render rather than whenever the page was built.
        accessorFn: (offer) => offerState(offer),
        cell: ({ row }) => {
          const state = offerState(row.original);
          return (
            <Badge variant={STATE_VARIANTS[state]}>
              {STATE_LABELS[state][language === "en" ? "en" : "zh"]}
            </Badge>
          );
        },
      },
      {
        accessorKey: "audience",
        header: language === "en" ? "Audience" : "对象",
        cell: ({ row }) => {
          const audience = row.original.audience;
          const labels = {
            MEMBERS: { en: "Members", zh: "会员" },
            EVERYONE: { en: "Everyone", zh: "所有人" },
            NEW_USERS: { en: "New users", zh: "新用户" },
          } as const;
          return (
            <div className="font-medium">
              {labels[audience][language === "en" ? "en" : "zh"]}
            </div>
          );
        },
      },
      {
        id: "appliesTo",
        header: language === "en" ? "Applies to" : "适用于",
        cell: ({ row }) => {
          const { dessert, category } = row.original;
          const target = dessert ?? category;
          if (!target) return <div className="text-muted-foreground">—</div>;
          return (
            <div className="font-medium">
              {language === "en" ? target.name : target.chineseName}
            </div>
          );
        },
      },
      {
        id: "reward",
        header: language === "en" ? "Reward" : "优惠内容",
        cell: ({ row }) => {
          const { itemPriceInCents, discountAmount } = row.original;

          // itemPriceInCents wins on the order server, so it is what we lead with.
          if (itemPriceInCents !== null) {
            return (
              <div className="font-medium">
                {formatCurrency(itemPriceInCents / 100)}
              </div>
            );
          }
          if (discountAmount !== null) {
            return <div className="font-medium">{discountAmount}% off</div>;
          }
          return <div className="text-muted-foreground">—</div>;
        },
      },
      {
        accessorKey: "limit",
        header: language === "en" ? "Limit" : "次数",
        /**
         * renewsWeekly is shown here rather than as its own column because that is
         * precisely what it modifies: with it on, the number is an allowance per week;
         * without it, it is the whole run. Two facts, one cell, no eleventh column.
         */
        cell: ({ row }) => {
          const { limit, renewsWeekly } = row.original;
          return (
            <div className="whitespace-nowrap font-medium">
              {renewsWeekly
                ? language === "en"
                  ? `${limit} / week`
                  : `${limit} / 每周`
                : limit}
            </div>
          );
        },
      },
      {
        accessorKey: "startsAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {language === "en" ? "Window" : "时段"}
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const { startsAt, endsAt } = row.original;
          if (!startsAt && !endsAt) {
            return <div className="text-muted-foreground">—</div>;
          }
          return (
            <div className="whitespace-nowrap font-medium">
              {startsAt ? dateFormatter.format(startsAt) : "—"}
              {" → "}
              {endsAt ? dateFormatter.format(endsAt) : "—"}
            </div>
          );
        },
      },
      {
        id: "requirements",
        header: language === "en" ? "Requirements" : "解锁条件",
        /**
         * Surfaced because the two shapes behave completely differently on the order
         * server: a gated offer has to be unlocked by a qualifying order before it can
         * be redeemed at all, and closing its run makes those customers earn it again.
         * Nothing else on this row says which kind you are looking at.
         */
        cell: ({ row }) => {
          const count = row.original.requirements.length;
          if (count === 0)
            return <div className="text-muted-foreground">—</div>;
          return <div className="font-medium">{count}</div>;
        },
      },
      {
        id: "redemptions",
        header: language === "en" ? "Redemptions" : "已兑换",
        cell: ({ row }) => (
          <div className="font-medium">{row.original._count.redemptions}</div>
        ),
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const offer = row.original;
          const state = offerState(offer);
          const isArchived = state === "ARCHIVED";
          // Same predicate the server enforces, so the menu never offers something
          // updateOffer or setActive would refuse.
          const ended = hasEnded(offer);

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
                  disabled={ended}
                  onClick={() => onEdit(offer)}
                >
                  {language === "en" ? "Edit offer" : "编辑优惠"}
                </DropdownMenuItem>

                {/* Says why the item above is greyed out, and what to do instead. */}
                {ended && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    {language === "en"
                      ? "Close the run to edit this offer."
                      : "请先结束此轮活动才能编辑。"}
                  </div>
                )}

                <DropdownMenuSeparator />

                {!isArchived &&
                  !ended &&
                  (offer.isActive ? (
                    <DropdownMenuItem onClick={() => onSetActive(offer, false)}>
                      {language === "en" ? "Deactivate" : "停用"}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => onSetActive(offer, true)}>
                      {language === "en" ? "Activate" : "启用"}
                    </DropdownMenuItem>
                  ))}

                {/* Offered whenever the end date has passed, active or paused - that is
                    the only state it is valid in, and the only way out of it. */}
                {ended && !isArchived && (
                  <DropdownMenuItem onClick={() => onCloseRun(offer)}>
                    {language === "en" ? "Close run" : "结束此轮活动"}
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem
                  onClick={() => onSetArchived(offer, !isArchived)}
                >
                  {isArchived
                    ? language === "en"
                      ? "Restore"
                      : "还原"
                    : language === "en"
                      ? "Archive"
                      : "封存"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [language, onEdit, onSetActive, onSetArchived, onCloseRun],
  );
}
