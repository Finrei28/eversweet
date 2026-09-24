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
 * Whether Sweet Points expire after a month without an app order.
 *
 * A switch rather than a setting with a number, because the rule is fixed - a month, the
 * whole balance, members exempt - and what the shop needs is to choose *when* it starts and
 * to be able to pause it. The moment it goes on is every customer's launch grace: the order
 * server counts nobody's month from before it.
 *
 * Both directions ask first. On takes points from real customers a month later; off and on
 * again restarts everyone's month, which is easy to do by accident with a bare toggle.
 */
export function PointsExpiryCard() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const utils = api.useUtils();

  const [{ expireFrom }] = api.settings.getPointsExpiry.useSuspenseQuery();
  const enabled = expireFrom !== null;

  // The switch position asked for, while the confirmation is open.
  const [pending, setPending] = useState<boolean | null>(null);

  const { mutate, isPending } = api.settings.setPointsExpiry.useMutation({
    onSuccess: async (result) => {
      setPending(null);
      // `settings` as a whole: the benefits card's preview depends on this switch too.
      await utils.settings.invalidate();
      toast({
        title:
          language === "en"
            ? result.expireFrom
              ? "Points expiry is on"
              : "Points expiry is paused"
            : result.expireFrom
              ? "积分过期已开启"
              : "积分过期已暂停",
        description:
          language === "en"
            ? "The app will pick this up within a minute."
            : "应用程序将在一分钟内更新。",
      });
    },
    onError: (error) =>
      toast({ variant: "destructive", description: error.message }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {language === "en" ? "Points expiry" : "积分过期"}
        </CardTitle>
        <CardDescription>
          {language === "en"
            ? "A customer's whole balance expires when a month passes without an app order. Active members' points never expire. Customers see the date in the app and get a notification a week before."
            : "顾客如一个月内未在应用程序下单，全部积分将过期。有效会员的积分永不过期。顾客可在应用程序中看到到期日期，并在到期前一周收到通知。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Switch
            checked={enabled}
            disabled={isPending}
            onCheckedChange={(checked) => setPending(checked)}
            aria-label={language === "en" ? "Points expire" : "积分过期"}
          />
          <span className="text-sm font-medium">
            {enabled
              ? language === "en"
                ? `On since ${formatDate(expireFrom.toISOString())}`
                : `自 ${formatDate(expireFrom.toISOString())} 起开启`
              : language === "en"
                ? "Off - no points expire"
                : "已关闭 - 积分不会过期"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {language === "en"
            ? "Turning it on gives every customer a full month from that moment, whatever they last ordered. Publish an announcement first, so nobody is surprised."
            : "开启后，每位顾客都将从开启时起获得完整的一个月，无论其上次下单时间。请先发布公告，以免顾客感到意外。"}
        </p>
      </CardContent>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={
          pending
            ? language === "en"
              ? "Turn on points expiry?"
              : "开启积分过期？"
            : language === "en"
              ? "Pause points expiry?"
              : "暂停积分过期？"
        }
        description={
          pending
            ? language === "en"
              ? "From a month from now, customers who have not ordered in the app for a month lose their whole points balance. Members are never affected."
              : "一个月后，一个月内未在应用程序下单的顾客将失去全部积分。会员不受影响。"
            : language === "en"
              ? "No points will expire while it is paused. Turning it back on later gives every customer a fresh month from that day."
              : "暂停期间积分不会过期。稍后重新开启时，每位顾客将从当天起重新获得一个月。"
        }
        confirmLabel={
          pending
            ? language === "en"
              ? "Turn on"
              : "开启"
            : language === "en"
              ? "Pause"
              : "暂停"
        }
        destructive={pending === true}
        loading={isPending}
        onConfirm={() => {
          if (pending !== null) mutate({ enabled: pending });
        }}
      />
    </Card>
  );
}
