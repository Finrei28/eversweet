"use client";

import { useState } from "react";

import ConfirmDialog from "~/app/admin/offers/_components/confirmDialog";
import { useLanguage } from "~/app/components/language";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";
import { useToast } from "~/hooks/use-toast";
import { formatDate } from "~/lib/formatters";
import { api } from "~/trpc/react";

/**
 * Whether the customer app shows the monthly leaderboard.
 *
 * Hiding is a presentation switch, not a pause of the competition: the order server goes on
 * ranking the month, settling the top three on the 1st, and taking prizes assigned on
 * /admin/winners, so showing it again picks up exactly where it would have been. What goes
 * from the app is the board, last month's podium, the "Show my name" setting, a winner's
 * "prize being prepared" card and the "You won a prize!" push. A prize already assigned
 * stays in the app with its code, because it is still the customer's to collect.
 *
 * Both directions ask first, as the points expiry switch does: hiding takes something
 * customers may be chasing out of the app mid-month.
 */
export function LeaderboardCard() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const utils = api.useUtils();

  const [{ hiddenAt }] =
    api.settings.getLeaderboardVisibility.useSuspenseQuery();
  const shown = hiddenAt === null;

  // The switch position asked for, while the confirmation is open.
  const [pending, setPending] = useState<boolean | null>(null);

  const { mutate, isPending } =
    api.settings.setLeaderboardVisibility.useMutation({
      onSuccess: async (result) => {
        setPending(null);
        await utils.settings.getLeaderboardVisibility.invalidate();
        toast({
          title:
            language === "en"
              ? result.hiddenAt
                ? "The leaderboard is hidden"
                : "The leaderboard is shown"
              : result.hiddenAt
                ? "排行榜已隐藏"
                : "排行榜已显示",
          description:
            language === "en"
              ? "The app will pick this up within a few minutes."
              : "应用程序将在几分钟内更新。",
        });
      },
      onError: (error) =>
        toast({ variant: "destructive", description: error.message }),
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{language === "en" ? "Leaderboard" : "排行榜"}</CardTitle>
        <CardDescription>
          {language === "en"
            ? "The monthly leaderboard in the app: this month's top earners and last month's top three. Hiding it does not stop the competition - points still count, the top three are still recorded on the 1st, and you can still assign prizes."
            : "应用程序中的每月排行榜：本月积分最高的顾客和上月前三名。隐藏它不会停止比赛 - 积分照常计算，每月1日照常记录前三名，您仍可分配奖品。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Switch
            checked={shown}
            disabled={isPending}
            onCheckedChange={(checked) => setPending(checked)}
            aria-label={
              language === "en" ? "Show the leaderboard" : "显示排行榜"
            }
          />
          <span className="text-sm font-medium">
            {shown
              ? language === "en"
                ? "Shown in the app"
                : "在应用程序中显示"
              : language === "en"
                ? `Hidden since ${formatDate(hiddenAt.toISOString())}`
                : `自 ${formatDate(hiddenAt.toISOString())} 起隐藏`}
          </span>
        </div>
      </CardContent>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={
          pending
            ? language === "en"
              ? "Show the leaderboard?"
              : "显示排行榜？"
            : language === "en"
              ? "Hide the leaderboard?"
              : "隐藏排行榜？"
        }
        description={
          pending
            ? language === "en"
              ? "The board comes back with this month's standings and last month's top three, as if it had never been hidden."
              : "排行榜将恢复显示本月排名和上月前三名，就像从未隐藏过一样。"
            : language === "en"
              ? "Customers will no longer see the leaderboard, last month's top three or a prize still being prepared. Prizes you have already assigned stay in the app. Prizes you assign while it is hidden are saved but the winner is not notified."
              : "顾客将不再看到排行榜、上月前三名或仍在准备中的奖品。已分配的奖品仍保留在应用程序中。隐藏期间分配的奖品会被保存，但不会通知获奖者。"
        }
        confirmLabel={
          pending
            ? language === "en"
              ? "Show"
              : "显示"
            : language === "en"
              ? "Hide"
              : "隐藏"
        }
        destructive={pending === false}
        loading={isPending}
        onConfirm={() => {
          if (pending !== null) mutate({ shown: pending });
        }}
      />
    </Card>
  );
}
