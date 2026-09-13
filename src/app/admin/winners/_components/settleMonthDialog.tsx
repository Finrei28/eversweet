"use client";

import { useEffect, useMemo, useState } from "react";

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

/** "2026-8": a Select value has to be a string. */
const keyFor = ({ month, year }: { month: number; year: number }) =>
  `${year}-${month}`;

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

  // Computed when the dialog opens rather than once at mount, so a tab left open across
  // the 1st does not still offer last month as the newest choice.
  const months = useMemo(() => (open ? finishedMonths() : []), [open]);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    if (open && months[0]) {
      setSelected(keyFor(months[0]));
      setError(null);
    }
  }, [open, months]);

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
    // could be mistaken for success and dismissed.
    onError: (mutationError) => setError(mutationError.message),
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
