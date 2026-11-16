"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { enNZ, zhCN } from "date-fns/locale";
import { useMemo, useState } from "react";

import ConfirmDialog from "~/app/admin/offers/_components/confirmDialog";
import { useLanguage } from "~/app/components/language";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useToast } from "~/hooks/use-toast";
import { dayAsCalendarDate, pickedDay, todayNZ } from "~/lib/aucklandDay";
import {
  formatDayOff,
  isOffInEdit,
  NO_EDIT,
  pendingDaysOff,
  toggleDayOff,
  type DaysOffEdit,
} from "~/lib/daysOff";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";

type BookedOrder = RouterOutputs["settings"]["getOrdersBookedOn"][number];

const PICK_UP_TIME = {
  en: new Intl.DateTimeFormat("en-NZ", {
    timeZone: "Pacific/Auckland",
    hour: "numeric",
    minute: "2-digit",
  }),
  zh: new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Pacific/Auckland",
    hour: "numeric",
    minute: "2-digit",
  }),
};

/**
 * One-off days the shop is closed, on top of its weekly hours: public holidays, a family
 * occasion, a fridge that has died. The staff app's Settings edits the same days.
 *
 * The calendar edits a change, not a copy of the list (`~/lib/daysOff`): the list
 * underneath can move while the card is open - the query refetches on focus, and a tablet
 * can save at any time - and a save sends only the days this admin clicked.
 *
 * Closing a day cancels none of the orders already booked on it and tells nobody, so the
 * card shows how many are booked on each day, and a save that closes a booked day lists
 * those orders and asks first.
 */
export function DaysOffCard() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const utils = api.useUtils();

  const [savedDays] = api.settings.getDaysOff.useSuspenseQuery();
  const saved = useMemo(() => new Set(savedDays), [savedDays]);

  const [edit, setEdit] = useState<DaysOffEdit>(NO_EDIT);
  const pending = useMemo(() => pendingDaysOff(saved, edit), [saved, edit]);
  const changes = pending.added.length + pending.removed.length;

  // Every day the list shows: those off, those about to be, and those about to reopen.
  const listed = useMemo(
    () => [...new Set([...savedDays, ...pending.added])].sort(),
    [savedDays, pending.added],
  );

  const { data: bookedOrders } = api.settings.getOrdersBookedOn.useQuery(
    { days: listed },
    { enabled: listed.length > 0, placeholderData: keepPreviousData },
  );
  const bookedCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const order of bookedOrders ?? []) {
      counts.set(order.day, (counts.get(order.day) ?? 0) + 1);
    }
    return counts;
  }, [bookedOrders]);

  // A save waiting on the admin, with the orders booked on the days it would close. The
  // change is kept with them so what is saved is what the orders were checked against.
  const [confirming, setConfirming] = useState<{
    change: { added: string[]; removed: string[] };
    orders: BookedOrder[];
  } | null>(null);
  const [checking, setChecking] = useState(false);

  const { mutate: save, isPending: saving } =
    api.settings.saveDaysOff.useMutation({
      onSuccess: async (days) => {
        setEdit(NO_EDIT);
        setConfirming(null);
        utils.settings.getDaysOff.setData(undefined, days);
        await utils.settings.getOrdersBookedOn.invalidate();
        toast({
          title: language === "en" ? "Days off saved" : "休息日已保存",
          description:
            language === "en"
              ? "The website has the change now, and the customer app within about ten minutes."
              : "网站已立即更新，顾客应用程序将在大约十分钟内更新。",
        });
      },
      onError: (error) => {
        // Back to the card, edit intact, rather than a warning left open over a save that
        // has already failed.
        setConfirming(null);
        toast({ variant: "destructive", description: error.message });
      },
    });

  const busy = saving || checking;

  const toggle = (day: string) => setEdit((e) => toggleDayOff(day, saved, e));

  /**
   * Asks the server, not the counts on screen, which orders are booked on the days being
   * closed: those can be a few seconds old, and an order placed since is the one staff
   * most need to hear about.
   */
  const onSave = async () => {
    const change = pending;
    if (change.added.length === 0) {
      save(change);
      return;
    }

    setChecking(true);
    try {
      const orders = await utils.settings.getOrdersBookedOn.fetch(
        { days: change.added },
        { staleTime: 0 },
      );
      if (orders.length === 0) save(change);
      else setConfirming({ change, orders });
    } catch (error) {
      toast({
        variant: "destructive",
        description:
          error instanceof Error
            ? error.message
            : language === "en"
              ? "Could not check for booked orders. Try again."
              : "无法检查已预订的订单，请重试。",
      });
    } finally {
      setChecking(false);
    }
  };

  // Today is Auckland's: a day off is a day on its calendar, wherever the admin is. Given
  // to the calendar as its "today" and opening month too, because this card is rendered on
  // the server, which runs in UTC. Left to itself the calendar reads the server's
  // `new Date()` - yesterday, for half of every Auckland day - and hydration keeps the
  // server's attributes, so the day marked as today stayed a day out.
  const firstOpenDay = dayAsCalendarDate(todayNZ());
  const shownOff = listed.filter((day) => isOffInEdit(day, saved, edit));

  const confirmingDays = useMemo(
    () => [...new Set((confirming?.orders ?? []).map((order) => order.day))],
    [confirming],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{language === "en" ? "Days off" : "休息日"}</CardTitle>
        <CardDescription>
          {language === "en"
            ? "Days the shop is closed on top of its weekly hours, such as public holidays. Customers can't order for pick-up on a day off: the website stops offering it as soon as you save, and the app within about ten minutes. The staff app's Settings changes the same days."
            : "在每周营业时间之外的休息日，例如公共假日。顾客无法预订在休息日取餐：保存后网站会立即停止提供该日期，应用程序则在大约十分钟内停止。员工应用程序的设置更改的是相同的日期。"}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6 md:flex-row md:items-start">
        <Calendar
          mode="multiple"
          selected={shownOff.map(dayAsCalendarDate)}
          onSelect={(_, clicked, modifiers) => {
            if (busy || modifiers.disabled) return;
            toggle(pickedDay(clicked));
          }}
          disabled={{ before: firstOpenDay }}
          fromDate={firstOpenDay}
          today={firstOpenDay}
          defaultMonth={firstOpenDay}
          locale={language === "en" ? enNZ : zhCN}
          className="self-center rounded-md border md:self-start"
        />

        <div className="flex-1 space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">
              {language === "en" ? "Coming up" : "即将到来"}
            </h3>

            {listed.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {language === "en"
                  ? "No days off coming up. Pick a day on the calendar to close it."
                  : "近期没有休息日。在日历上选择一天即可设为休息日。"}
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {listed.map((day) => {
                  const isNew = pending.added.includes(day);
                  const reopening = pending.removed.includes(day);
                  const booked = bookedCount.get(day) ?? 0;

                  return (
                    <li
                      key={day}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            reopening && "text-muted-foreground line-through",
                          )}
                        >
                          {formatDayOff(day, language)}
                        </span>
                        {isNew && (
                          <Badge variant="secondary">
                            {language === "en" ? "Not saved" : "未保存"}
                          </Badge>
                        )}
                        {reopening && (
                          <Badge variant="outline">
                            {language === "en" ? "Reopening" : "将恢复营业"}
                          </Badge>
                        )}
                        {booked > 0 && !reopening && (
                          <span className="text-amber-700">
                            {language === "en"
                              ? `${booked} ${booked === 1 ? "order" : "orders"} booked`
                              : `已预订 ${booked} 个订单`}
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => toggle(day)}
                      >
                        {isNew || reopening
                          ? language === "en"
                            ? "Undo"
                            : "撤销"
                          : language === "en"
                            ? "Reopen"
                            : "恢复营业"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy || changes === 0}
              onClick={() => setEdit(NO_EDIT)}
            >
              {language === "en" ? "Discard changes" : "放弃更改"}
            </Button>
            <Button
              type="button"
              disabled={busy || changes === 0}
              onClick={() => void onSave()}
            >
              {busy
                ? language === "en"
                  ? "Saving..."
                  : "保存中..."
                : language === "en"
                  ? changes > 1
                    ? `Save ${changes} changes`
                    : "Save"
                  : changes > 1
                    ? `保存 ${changes} 项更改`
                    : "保存"}
            </Button>
          </div>
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        title={
          language === "en"
            ? confirmingDays.length === 1
              ? "Orders are booked on a day you're closing"
              : "Orders are booked on days you're closing"
            : "您要设为休息日的日期已有订单"
        }
        description={
          language === "en"
            ? "Closing a day doesn't cancel these orders or tell the customers. Contact them, and cancel an order from the staff app if they can't come another day."
            : "设为休息日不会取消这些订单，也不会通知顾客。请联系他们；如果他们无法改天取餐，请在员工应用程序中取消订单。"
        }
        confirmLabel={language === "en" ? "Close these days" : "设为休息日"}
        destructive
        loading={saving}
        onConfirm={() => {
          if (confirming) save(confirming.change);
        }}
      >
        <div className="max-h-72 space-y-3 overflow-y-auto text-sm">
          {confirmingDays.map((day) => (
            <div key={day} className="space-y-1">
              <p className="font-medium">{formatDayOff(day, language)}</p>
              <ul className="space-y-1">
                {(confirming?.orders ?? [])
                  .filter((order) => order.day === day)
                  .map((order) => (
                    <li
                      key={order.id}
                      className="flex flex-wrap gap-x-2 text-muted-foreground"
                    >
                      <span className="text-foreground">
                        {PICK_UP_TIME[language].format(order.pickUpTime)}
                      </span>
                      <span>{order.customerName}</span>
                      {order.customerPhoneNumber && (
                        <span>{order.customerPhoneNumber}</span>
                      )}
                      <span>
                        {order.source === "APP"
                          ? language === "en"
                            ? "App"
                            : "应用程序"
                          : language === "en"
                            ? "Website"
                            : "网站"}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </ConfirmDialog>
    </Card>
  );
}
