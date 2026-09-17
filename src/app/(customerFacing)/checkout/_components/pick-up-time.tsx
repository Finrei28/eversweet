"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { zhCN, enNZ } from "date-fns/locale";
import { CalendarIcon, Clock, Info } from "lucide-react";

import { Calendar } from "~/components/ui/calendar";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useLanguage } from "~/app/components/language";
import {
  addDaysToKey,
  asapPickUpTime,
  formatMinutes,
  formatNZ,
  hoursOn,
  isTooSoon,
  LAST_PICK_UP_OFFSET_MINUTES,
  nextDayWithSlots,
  nzDayKey,
  pickUpProblem,
  pickUpSlots,
  toDaysOffKeys,
  toWeeklyHours,
  type TradingCalendar,
} from "~/lib/pickUpTimes";
import { quoteMinutes } from "~/lib/prepTimes";
import { api } from "~/trpc/react";

type PickupTimeProps = {
  onChange: (date: Date | null) => void;
  value: Date | null;
  setPickUpNextOpening: (boolean: boolean) => void;
  numberOfItems: number;
  daysOff: Date[];
  /** How far the device's clock is behind the server's; see the checkout page. */
  clockSkewMs: number;
};

/** How far ahead a website order can be booked. */
const BOOKING_DAYS_AHEAD = 14;

/** How often the soonest time is worked out again while the page is open. */
const REFRESH_MS = 5000;

/**
 * The calendar grid shows the customer's local dates, and the day they click is the
 * Auckland day they mean. These convert between that grid and Auckland calendar-day keys
 * without passing through an instant, which is what shifted days for a browser outside
 * New Zealand.
 */
const gridDayKey = (date: Date) => format(date, "yyyy-MM-dd");
const gridDate = (dayKey: string) => {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year!, month! - 1, day);
};

/**
 * Picks the pick-up time for a website order.
 *
 * Every rule - the hours, the last pick-up 10 minutes before closing, the kitchen's quote,
 * moving to the next opening once today has nothing left - is `~/lib/pickUpTimes`, on the
 * Auckland clock whatever the customer's device is set to. This component only keeps the
 * chosen time valid as the clock and the cart move, and the server checks it again before
 * the customer pays.
 */
export function PickupTimePicker({
  onChange,
  value,
  setPickUpNextOpening,
  numberOfItems,
  daysOff,
  clockSkewMs,
}: PickupTimeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"asap" | "custom">("asap");
  const { language } = useLanguage();
  const locale = language === "en" ? enNZ : zhCN;

  // Shared with the kitchen, so the time offered here and the moment staff are told to
  // start it come from the same row.
  const { data: prepTimes } = api.store.getPrepTimes.useQuery();
  const { data: hoursRows, isError: hoursFailed } =
    api.store.getTradingHours.useQuery();

  // The device's clock, corrected by what the server's check last said about it.
  const [now, setNow] = useState(() => new Date(Date.now() + clockSkewMs));
  useEffect(() => {
    setNow(new Date(Date.now() + clockSkewMs));
    const interval = setInterval(
      () => setNow(new Date(Date.now() + clockSkewMs)),
      REFRESH_MS,
    );
    return () => clearInterval(interval);
  }, [clockSkewMs]);

  const calendar = useMemo<TradingCalendar | null>(
    () =>
      hoursRows
        ? { hours: toWeeklyHours(hoursRows), daysOff: toDaysOffKeys(daysOff) }
        : null,
    [hoursRows, daysOff],
  );

  const quote = quoteMinutes(numberOfItems, prepTimes);
  const asap = useMemo(
    () => (calendar ? asapPickUpTime(now, quote, calendar) : null),
    [calendar, now, quote],
  );
  const asapTime = asap?.getTime() ?? null;
  const valueTime = value?.getTime() ?? null;
  const todayKey = nzDayKey(now);

  /**
   * Keeps the chosen time one the shop can take. ASAP follows the soonest time in both
   * directions - a smaller cart can make it sooner. A time the customer picked is left
   * alone until it stops being valid: the kitchen could no longer make it, or last orders
   * or a day off have closed it. Then it becomes the soonest time instead of lingering.
   */
  useEffect(() => {
    if (!calendar) return;

    const stillValid =
      value !== null &&
      pickUpProblem(value, calendar) === null &&
      !isTooSoon(value, now, quote);

    // Compares instants, so setting the value settles it: no loop.
    if (selectedTab === "asap" ? valueTime !== asapTime : !stillValid) {
      onChange(asapTime === null ? null : new Date(asapTime));
    }
  }, [calendar, selectedTab, asapTime, valueTime, value, now, quote, onChange]);

  // The checkout warns before payment when the time is not today.
  const onAnotherDay = value !== null && nzDayKey(value) !== todayKey;
  useEffect(() => {
    setPickUpNextOpening(onAnotherDay);
  }, [onAnotherDay, setPickUpNextOpening]);

  /** Whether a calendar day has anything to book. Only today can be open yet empty. */
  const isBookableDay = (dayKey: string) => {
    if (!calendar) return false;
    if (
      dayKey < todayKey ||
      dayKey > addDaysToKey(todayKey, BOOKING_DAYS_AHEAD)
    ) {
      return false;
    }
    if (!hoursOn(dayKey, calendar)) return false;
    return (
      dayKey !== todayKey ||
      pickUpSlots(dayKey, now, quote, calendar).length > 0
    );
  };

  const handleAsapSelect = () => {
    setSelectedTab("asap");
    onChange(asap);
    setIsOpen(false);
  };

  // Opens the calendar on the time already showing, so the screen does not jump.
  const handlePickLaterSelect = () => {
    setSelectedTab("custom");
    if (!value && asap) onChange(asap);
  };

  /**
   * A day's first time the kitchen can make. A day with nothing left - today after its
   * last pick-up - moves on to the next day that has one, rather than offering the
   * opening time that has already passed, which is what this used to do.
   */
  const handleDateSelect = (date: Date | undefined) => {
    if (!date || !calendar) return;
    setSelectedTab("custom");

    const dayKey = nextDayWithSlots(gridDayKey(date), now, quote, calendar);
    const first = dayKey && pickUpSlots(dayKey, now, quote, calendar)[0];
    if (first) onChange(first);
  };

  const handleTimeSelect = (time: Date) => {
    onChange(time);
    setIsOpen(false);
  };

  const t = (en: string, zh: string) => (language === "en" ? en : zh);

  if (hoursFailed) {
    return (
      <p className="text-sm text-destructive">
        {t(
          "We couldn't load our opening hours. Please refresh the page to try again.",
          "无法加载营业时间，请刷新页面重试。",
        )}
      </p>
    );
  }

  if (calendar && asap === null) {
    return (
      <p className="text-sm text-muted-foreground">
        {t(
          "We're not taking pick-up orders at the moment. Please check back soon.",
          "我们目前不接受取货订单，请稍后再来。",
        )}
      </p>
    );
  }

  const valueDayKey = value ? nzDayKey(value) : null;
  const valueDayHours =
    valueDayKey && calendar ? hoursOn(valueDayKey, calendar) : null;
  const slots =
    valueDayKey && calendar
      ? pickUpSlots(valueDayKey, now, quote, calendar)
      : [];

  const formatDisplayValue = () => {
    if (!value || !calendar)
      return t("Loading pick-up times...", "正在加载取货时间...");

    if (selectedTab === "asap") {
      return nzDayKey(value) === todayKey
        ? `${t("ASAP (approx. ", "尽快 (大概 ")}${formatNZ(value, "EEE, h:mm a", { locale })})`
        : `${t("Next opening: ", "下次营业: ")}${formatNZ(value, "EEE, MMM d, h:mm a", { locale })}`;
    }

    return formatNZ(value, "EEE, MMM d, h:mm a", { locale });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={!calendar}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
          )}
        >
          {selectedTab === "asap" ? (
            <Clock className="mr-2 h-4 w-4" />
          ) : (
            <CalendarIcon className="mr-2 h-4 w-4" />
          )}
          {formatDisplayValue()}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[100vw] max-w-[440px] p-0 md:w-auto"
        align="start"
      >
        <Tabs
          value={selectedTab}
          onValueChange={(v) => setSelectedTab(v as "asap" | "custom")}
        >
          <div className="border-b p-3">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="asap" onClick={handleAsapSelect}>
                {t("ASAP", "尽快")}
              </TabsTrigger>
              <TabsTrigger value="custom" onClick={handlePickLaterSelect}>
                {t("Pick up later", "稍后取货")}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="asap" className="p-4">
            <div className="space-y-2">
              {asap && nzDayKey(asap) !== todayKey ? (
                <p className="text-sm text-muted-foreground">
                  {t(
                    "There are no pick-up times left today. The soonest is when we next open.",
                    "今天已没有可取货时间。最早可在下次营业时取货。",
                  )}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t(
                    "Your order will be ready for pickup as soon as possible.",
                    "您的订单将尽快准备好供取货.",
                  )}
                </p>
              )}
              <p className="font-medium">
                {t("Estimated time: ", "预计时间: ")}
                {asap
                  ? formatNZ(asap, "EEE, MMM d, h:mm a", { locale })
                  : t("Loading...", "加载中...")}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="custom" className="p-0">
            <div className="flex flex-col md:flex-row">
              <div className="w-full md:w-auto">
                <Calendar
                  mode="single"
                  locale={enNZ}
                  selected={valueDayKey ? gridDate(valueDayKey) : undefined}
                  defaultMonth={valueDayKey ? gridDate(valueDayKey) : undefined}
                  onSelect={handleDateSelect}
                  disabled={(date) => !isBookableDay(gridDayKey(date))}
                  modifiers={{
                    closed: (date) =>
                      !!calendar && !hoursOn(gridDayKey(date), calendar),
                  }}
                  modifiersClassNames={{
                    closed: "text-red-500 line-through opacity-50",
                  }}
                  initialFocus
                  className="flex justify-center border-r"
                />
                {valueDayHours && value && (
                  <div className="border-t p-2 text-center text-sm">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex cursor-help items-center justify-center gap-1">
                            <span>
                              {t("Hours: ", "营业时间: ")}
                              {formatMinutes(valueDayHours.opensAt)} -{" "}
                              {formatMinutes(valueDayHours.closesAt)}
                            </span>
                            <Info className="h-3 w-3" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {t("Last pick-up on ", "最后取货时间，")}
                            {formatNZ(value, "EEEE", { locale })}
                            {": "}
                            {formatMinutes(
                              valueDayHours.closesAt -
                                LAST_PICK_UP_OFFSET_MINUTES,
                            )}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              </div>

              <div className="w-full p-3 sm:w-[200px]">
                <h3 className="mb-2 text-sm font-medium">
                  {t("Available Times", "可取货时间")}
                </h3>
                <ScrollArea className="h-72">
                  <div className="grid grid-cols-2 gap-2 pr-3">
                    {slots.map((time) => (
                      <Button
                        key={time.getTime()}
                        variant={
                          valueTime === time.getTime() ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => handleTimeSelect(time)}
                      >
                        {formatNZ(time, "h:mm a")}
                      </Button>
                    ))}
                    {value && slots.length === 0 && (
                      <p className="col-span-2 py-4 text-center text-sm text-muted-foreground">
                        {t(
                          "No pick-up times left on this date. Please select another date.",
                          "此日期没有可用时间。请选择其他日期.",
                        )}
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
