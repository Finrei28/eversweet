"use client";

import { useEffect, useRef, useState } from "react";

import { useLanguage } from "~/app/components/language";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { toast } from "~/hooks/use-toast";
import { finishedMonths, monthLabel } from "~/lib/winnerRewards";
import { api } from "~/trpc/react";

type SettleMonthDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Month = ReturnType<typeof finishedMonths>[number];

/** "2026-8": a Select value has to be a string. */
const keyFor = ({ month, year }: Month) => `${year}-${month}`;

/**
 * Records a month's podium by hand, for when the order server's cron missed NZ midnight
 * on the 1st. Nothing else ever writes a podium, so without this that month's winners are
 * simply never recorded.
 *
 * A list of finished months rather than a date picker, so the month still being competed
 * for cannot be chosen at all — settling it early would freeze a podium with weeks of
 * points still to come, and a settled month is never revisited.
 *
 * Pressing it on a month that is already settled is harmless: the order server writes
 * nothing and says so.
 */
export default function SettleMonthDialog({
  open,
  onOpenChange,
}: SettleMonthDialogProps) {
  const { language } = useLanguage();
  const utils = api.useUtils();
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState<Month[]>(() => finishedMonths());
  const [selected, setSelected] = useState(() =>
    months[0] ? keyFor(months[0]) : "",
  );

  // Refilled each time the dialog opens rather than once at mount, so a tab left open
  // across the 1st does not still offer last month as the newest choice. Held in state
  // rather than derived from `open`: emptying it on close blanked the picker while the
  // dialog was still fading out.
  useEffect(() => {
    if (open) {
      const fresh = finishedMonths();
      setMonths(fresh);
      setSelected(fresh[0] ? keyFor(fresh[0]) : "");
      setError(null);
    }
  }, [open]);

  // Cleared on close too, like the other admin dialogs, so an error from this visit is
  // gone before the next one paints instead of flashing until the open effect runs.
  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current && !open) {
      setError(null);
    }
    prevOpen.current = open;
  }, [open]);

  const settleMonth = api.winner.settleMonth.useMutation({
    onSuccess: async (result) => {
      await utils.winner.invalidate();
      onOpenChange(false);

      const label = monthLabel(result.month, result.year, language);
      const description =
        result.outcome === "RECORDED"
          ? language === "en"
            ? `Recorded ${result.recorded} ${result.recorded === 1 ? "winner" : "winners"} for ${label}.`
            : `已记录 ${label} 的 ${result.recorded} 位得奖者。`
          : result.outcome === "ALREADY_SETTLED"
            ? language === "en"
              ? `${label} was already settled. Nothing was changed.`
              : `${label} 已结算，未做任何更改。`
            : language === "en"
              ? `Nobody earned points in ${label}, so there are no winners to record.`
              : `${label} 无人获得积分，没有得奖者可记录。`;

      toast({
        title: language === "en" ? "Month settled" : "月份已结算",
        description,
      });
    },
    // A failed settle shows here and keeps the dialog open, rather than a toast that
    // could be mistaken for success and dismissed. Unless the dialog was closed while it
    // was running: then there is nowhere to show it, and setting it would only surface it
    // on the next open as if that visit had failed. A destructive toast says it instead.
    // Read through the ref because the callback was captured when `mutate` was called.
    onError: (mutationError) => {
      if (prevOpen.current) {
        setError(mutationError.message);
        return;
      }
      toast({
        variant: "destructive",
        title: language === "en" ? "Month not settled" : "月份结算失败",
        description: mutationError.message,
      });
    },
  });

  const submit = () => {
    const choice = months.find((month) => keyFor(month) === selected);
    if (!choice) return;
    setError(null);
    settleMonth.mutate(choice);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {language === "en" ? "Settle a missed month" : "补结算月份"}
          </DialogTitle>
          <DialogDescription>
            {language === "en"
              ? "Months are settled automatically at midnight on the 1st. Use this only if that did not happen — for example the server was down. Settling a month that is already settled changes nothing."
              : "每月1日午夜会自动结算。仅在自动结算未执行时使用（例如服务器当时停机）。对已结算的月份操作不会有任何更改。"}
          </DialogDescription>
        </DialogHeader>

        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((month) => (
              <SelectItem key={keyFor(month)} value={keyFor(month)}>
                {monthLabel(month.month, month.year, language)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {error && (
          <span className="flex flex-col items-center justify-center text-destructive">
            {error}
          </span>
        )}

        <DialogFooter>
          <div className="flex w-full flex-col items-center justify-center">
            <Button
              type="button"
              onClick={submit}
              disabled={settleMonth.isPending || !selected}
              className="mt-5 w-10/12 rounded-xl"
            >
              {settleMonth.isPending
                ? language === "en"
                  ? "Settling..."
                  : "正在结算..."
                : language === "en"
                  ? "Settle month"
                  : "结算月份"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
