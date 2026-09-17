"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Copy, MoreHorizontal } from "lucide-react";
import { useMemo } from "react";

import { useLanguage } from "~/app/components/language";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  formatPrizeCode,
  monthLabel,
  rewardStatus,
  type RewardStatus,
} from "~/lib/winnerRewards";
import { type RouterOutputs } from "~/trpc/react";

export type WinnerRow = RouterOutputs["winner"]["getWinners"][number];

type ColumnProps = {
  onEditReward: (winner: WinnerRow) => void;
};

const dateFormatter = new Intl.DateTimeFormat("en-NZ");

const STATUS_LABELS: Record<RewardStatus, { en: string; zh: string }> = {
  UNASSIGNED: { en: "No reward", zh: "未设置奖品" },
  ASSIGNED: { en: "Ready to collect", zh: "待领取" },
  REDEEMED: { en: "Collected", zh: "已领取" },
  EXPIRED: { en: "Expired", zh: "已过期" },
};

const STATUS_VARIANTS: Record<
  RewardStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  UNASSIGNED: "outline",
  ASSIGNED: "default",
  REDEEMED: "secondary",
  EXPIRED: "destructive",
};

/** Whatever the shop can actually call this person at the counter. */
const winnerName = (user: WinnerRow["user"]) => {
  if (!user) return null;
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return full || user.username || user.email;
};

export function GetWinnerColumns({
  onEditReward,
}: ColumnProps): ColumnDef<WinnerRow>[] {
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
  return useMemo<ColumnDef<WinnerRow>[]>(
    () => [
      {
        accessorKey: "year",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {language === "en" ? "Month" : "月份"}
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="whitespace-nowrap font-medium">
            {monthLabel(
              row.original.month,
              row.original.year,
              language === "en" ? "en" : "zh",
            )}
          </div>
        ),
      },
      {
        accessorKey: "place",
        header: language === "en" ? "Place" : "名次",
        cell: ({ row }) => (
          <Badge variant={row.original.place === 1 ? "default" : "secondary"}>
            {row.original.place}
          </Badge>
        ),
      },
      {
        id: "winner",
        header: language === "en" ? "Winner" : "得奖者",
        cell: ({ row }) => {
          const { user } = row.original;
          const name = winnerName(user);

          // userId is SetNull on account deletion, so the row outlives the account.
          if (!name) {
            return (
              <div className="text-muted-foreground">
                {language === "en" ? "Account closed" : "账户已注销"}
              </div>
            );
          }

          return (
            <div className="flex flex-col">
              <span className="font-medium">{name}</span>
              {/* The real name still shows: the shop has to know who is collecting.
                The badge is a reminder that the public leaderboard does not. */}
              {user?.anonymousEnabled && (
                <Badge variant="outline" className="mt-1 w-fit text-xs">
                  {language === "en"
                    ? "Anonymous on leaderboard"
                    : "排行榜匿名"}
                </Badge>
              )}
            </div>
          );
        },
        filterFn: (row, _columnId, filterValue: string) => {
          const name = winnerName(row.original.user)?.toLowerCase();
          return name ? name.includes(filterValue.toLowerCase()) : false;
        },
      },
      {
        accessorKey: "points",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {language === "en" ? "Points" : "积分"}
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="font-medium">{row.original.points}</div>
        ),
      },
      {
        id: "reward",
        header: language === "en" ? "Reward" : "奖品",
        cell: ({ row }) => {
          const reward = row.original.reward;
          if (!reward) return <div className="text-muted-foreground">—</div>;
          return <div className="font-medium">{reward.title}</div>;
        },
      },
      {
        id: "code",
        header: language === "en" ? "Code" : "兑换码",
        cell: ({ row }) => {
          const reward = row.original.reward;
          if (!reward) return <div className="text-muted-foreground">—</div>;

          // Grouped the way the save toast and the customer's app show it.
          const code = formatPrizeCode(reward.code);

          return (
            <div className="flex items-center gap-1">
              <span className="font-mono tracking-wider">{code}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => void navigator.clipboard.writeText(code)}
              >
                <span className="sr-only">Copy code</span>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          );
        },
      },
      {
        id: "expires",
        header: language === "en" ? "Expires" : "有效期至",
        cell: ({ row }) => {
          const reward = row.original.reward;
          if (!reward) return <div className="text-muted-foreground">—</div>;
          return (
            <div className="whitespace-nowrap font-medium">
              {dateFormatter.format(reward.expiresAt)}
            </div>
          );
        },
      },
      {
        id: "status",
        header: language === "en" ? "Status" : "状态",
        cell: ({ row }) => {
          const status = rewardStatus(row.original.reward);
          return (
            <Badge variant={STATUS_VARIANTS[status]}>
              {STATUS_LABELS[status][language === "en" ? "en" : "zh"]}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const winner = row.original;

          /**
           * Both conditions mirror a guard in the winners router, so the menu never
           * offers something the server will refuse. There is no "mark collected" item:
           * codes are redeemed at the counter through the admin mobile app, and nothing
           * on this website writes redeemedAt.
           */
          const accountClosed = !winner.user;
          const alreadyCollected = !!winner.reward?.redeemedAt;

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
                  disabled={accountClosed || alreadyCollected}
                  onClick={() => onEditReward(winner)}
                >
                  {winner.reward
                    ? language === "en"
                      ? "Edit reward"
                      : "编辑奖品"
                    : language === "en"
                      ? "Assign reward"
                      : "设置奖品"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [language, onEditReward],
  );
}
