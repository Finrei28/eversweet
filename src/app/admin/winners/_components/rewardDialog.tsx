"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { type z } from "zod";

import DateField from "~/app/components/dateField";
import { useLanguage } from "~/app/components/language";
import { upsertRewardSchema } from "~/app/components/schemas";
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
  Form,
  FormControl,
  FormField,
  FormInput,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "~/hooks/use-toast";
import { defaultRewardExpiry, monthLabel } from "~/lib/winnerRewards";
import { api } from "~/trpc/react";
import { type WinnerRow } from "../columns";

type RewardForm = z.infer<typeof upsertRewardSchema>;

type RewardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  winner: WinnerRow | null;
};

export default function RewardDialog({
  open,
  onOpenChange,
  winner,
}: RewardDialogProps) {
  const { language } = useLanguage();
  const utils = api.useUtils();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<RewardForm>({
    resolver: zodResolver(upsertRewardSchema),
    defaultValues: {
      winnerId: "",
      title: "",
      description: "",
      expiresAt: new Date(),
    },
  });

  const upsertReward = api.winner.upsertReward.useMutation({
    onSuccess: async (data) => {
      await utils.winner.invalidate();
      onOpenChange(false);
      // Said out loud because it only happens on the first assign, and only when the
      // winner has notifications on. Otherwise staff cannot tell whether the customer
      // knows yet.
      const notice = data.notified
        ? language === "en"
          ? " The winner has been notified."
          : " 已通知得奖者。"
        : "";
      toast({
        title: language === "en" ? "Reward saved" : "奖品已保存",
        description:
          language === "en"
            ? `${data.title} — code ${data.code}.${notice}`
            : `${data.title} — 兑换码 ${data.code}。${notice}`,
      });
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  // Prefill from the winner's own month, so assigning a prize is a title and one click.
  useEffect(() => {
    if (open && winner) {
      form.reset({
        winnerId: winner.id,
        title: winner.reward?.title ?? "",
        description: winner.reward?.description ?? "",
        expiresAt:
          winner.reward?.expiresAt ??
          defaultRewardExpiry(winner.month, winner.year),
      });
      setError(null);
    }
  }, [open, winner, form]);

  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current && !open) {
      form.clearErrors();
      setError(null);
    }
    prevOpen.current = open;
  }, [open, form]);

  if (!winner) return null;

  const reward = winner.reward;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {reward
              ? language === "en"
                ? "Edit reward"
                : "编辑奖品"
              : language === "en"
                ? "Assign reward"
                : "设置奖品"}
          </DialogTitle>
          <DialogDescription>
            {language === "en"
              ? `Place ${winner.place}, ${monthLabel(winner.month, winner.year, "en")}. The winner collects this in store.`
              : `${monthLabel(winner.month, winner.year, "zh")} 第 ${winner.place} 名，顾客到店领取。`}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => upsertReward.mutate(data))}
            className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pb-2 pt-2"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <div>
                  <FormLabel>
                    {language === "en" ? "Prize" : "奖品"}
                  </FormLabel>
                  <FormControl>
                    <FormInput
                      placeholder={
                        language === "en"
                          ? "e.g. Free large dessert"
                          : "例如：免费大份甜品"
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </div>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <div>
                  <FormLabel>
                    {language === "en" ? "Details" : "详情"}
                  </FormLabel>
                  <FormControl>
                    <Textarea className="resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </div>
              )}
            />

            <FormField
              control={form.control}
              name="expiresAt"
              render={({ field }) => (
                <div>
                  <FormLabel>
                    {language === "en" ? "Collect by" : "领取截止"}
                  </FormLabel>
                  <DateField
                    value={field.value}
                    onChange={(date) => date && field.onChange(date)}
                    placeholder={language === "en" ? "Pick a date" : "选择日期"}
                    disabled={(date) => date < new Date()}
                  />
                  <p className="mt-1 text-sm text-muted-foreground">
                    {language === "en"
                      ? "Defaults to the end of the month after the one that was won."
                      : "默认为获奖月份次月的月底。"}
                  </p>
                  <FormMessage />
                </div>
              )}
            />

            {/* The winner is already looking at this code in the app, so it is never
                regenerated by an edit. */}
            {reward && (
              <div className="rounded-md bg-muted p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono tracking-wider">
                    {reward.code}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      void navigator.clipboard.writeText(reward.code)
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {language === "en"
                    ? "The winner already has this code — it cannot be changed. Staff redeem it in the admin app."
                    : "顾客已收到此兑换码，无法更改。店员在管理应用中进行核销。"}
                </p>
              </div>
            )}

            {error && (
              <span className="flex flex-col items-center justify-center text-destructive">
                {error}
              </span>
            )}

            <DialogFooter>
              <div className="flex w-full flex-col items-center justify-center">
                <Button
                  disabled={upsertReward.isPending}
                  className="mt-5 w-10/12 rounded-xl"
                >
                  {upsertReward.isPending
                    ? language === "en"
                      ? "Saving..."
                      : "正在保存..."
                    : language === "en"
                      ? "Save reward"
                      : "保存奖品"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
