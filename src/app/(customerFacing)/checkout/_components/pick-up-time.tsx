"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Clock } from "lucide-react";

import { cn } from "~/lib/utils";
import { useLanguage } from "~/app/components/language";
import {
  addDaysToKey,
  asapPickUpTime,
  hoursOn,
  isTooSoon,
  nextDayWithSlots,
  nzDayKey,
  nzMinuteOfDay,
  pickUpProblem,
  pickUpSlots,
  toDaysOffKeys,
  toWeeklyHours,
  type TradingCalendar,
} from "~/lib/pickUpTimes";
import {
  dayChip,
  hoursLine,
  pickUpTimeLabel,
  visibleSlots,
} from "~/lib/pickUpLabels";
import { timeOfDay } from "~/lib/openToday";
import { scrollBehavior } from "~/lib/scrollBehavior";
import { quoteMinutes } from "~/lib/prepTimes";
import { api } from "~/trpc/react";

type PickupTimeProps = {
  onChange: (date: Date | null) => void;
  value: Date | null;
  setPickUpNextOpening: (boolean: boolean) => void;
  /** Whether the time is the soonest (ASAP) rather than one picked; see the summary. */
  setPickUpAsap: (asap: boolean) => void;
  numberOfItems: number;
  daysOff: Date[];
  /** How far the device's clock is behind the server's; see the checkout page. */
  clockSkewMs: number;
};

/** How far ahead a website order can be booked. */
const BOOKING_DAYS_AHEAD = 14;

/** How often the soonest time is worked out again while the page is open. */
const REFRESH_MS = 5000;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Picks the pick-up time for a website order.
 *
 * Every rule - the hours, the last pick-up 10 minutes before closing, the kitchen's quote,
 * moving to the next opening once today has nothing left - is `~/lib/pickUpTimes`, on the
 * Auckland clock whatever the customer's device is set to. This component only keeps the
 * chosen time valid as the clock and the cart move, and the server checks it again before
 * the customer pays.
 *
 * Drawn in the page, as direction D's checkout has it: ASAP or Pick up later, then for a
 * later time a strip of days and a grid of times. It used to be a popover holding a month
 * calendar. The days are Auckland day keys throughout, so nothing here converts through a
 * browser-local date any more.
 */
export function PickupTimePicker({
  onChange,
  value,
  setPickUpNextOpening,
  setPickUpAsap,
  numberOfItems,
  daysOff,
  clockSkewMs,
}: PickupTimeProps) {
  const [selectedTab, setSelectedTab] = useState<"asap" | "custom">("asap");
  // The day whose "Later times" was pressed, so another day starts short again.
  const [showAllFor, setShowAllFor] = useState<string | null>(null);
  const { language } = useLanguage();

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

  // The order summary calls an ASAP time "about" that time.
  useEffect(() => {
    setPickUpAsap(selectedTab === "asap");
  }, [selectedTab, setPickUpAsap]);

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
  };

  // Opens on the time already showing, so the screen does not jump.
  const handlePickLaterSelect = () => {
    setSelectedTab("custom");
    if (!value && asap) onChange(asap);
  };

  /**
   * A day's first time the kitchen can make. A day with nothing left - today after its
   * last pick-up - moves on to the next day that has one, rather than offering the
   * opening time that has already passed, which is what this used to do.
   */
  const handleDaySelect = (dayKey: string) => {
    if (!calendar) return;
    setSelectedTab("custom");

    const day = nextDayWithSlots(dayKey, now, quote, calendar);
    const first = day && pickUpSlots(day, now, quote, calendar)[0];
    if (first) onChange(first);
  };

  const handleTimeSelect = (time: Date) => {
    onChange(time);
  };

  const t = (en: string, zh: string) => (language === "en" ? en : zh);

  const valueDayKey = value ? nzDayKey(value) : null;
  const valueDayHours =
    valueDayKey && calendar ? hoursOn(valueDayKey, calendar) : null;
  const slots =
    valueDayKey && calendar
      ? pickUpSlots(valueDayKey, now, quote, calendar)
      : [];
  const { shown, more } = visibleSlots(
    slots,
    valueTime,
    showAllFor !== null && showAllFor === valueDayKey,
  );

  // Keeps the picked day in view in the strip, which scrolls sideways.
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const strip = stripRef.current;
    const chip = strip?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!strip || !chip) return;
    const start = chip.offsetLeft;
    const end = start + chip.offsetWidth;
    if (
      start < strip.scrollLeft ||
      end > strip.scrollLeft + strip.clientWidth
    ) {
      strip.scrollTo({ left: start - 20, behavior: scrollBehavior() });
    }
  }, [valueDayKey, selectedTab]);

  // "Later times" goes once pressed, so focus moves to the first time it revealed.
  const gridRef = useRef<HTMLDivElement>(null);
  const revealFrom = useRef<number | null>(null);
  useEffect(() => {
    if (revealFrom.current === null) return;
    gridRef.current
      ?.querySelectorAll<HTMLButtonElement>("button")
      [revealFrom.current]?.focus();
    revealFrom.current = null;
  }, [showAllFor]);

  const modeRefs = useRef<(HTMLButtonElement | null)[]>([]);

  if (hoursFailed) {
    return (
      <p className="text-[15px] text-destructive">
        {t(
          "We couldn't load our opening hours. Please refresh the page to try again.",
          "无法加载营业时间，请刷新页面重试。",
        )}
      </p>
    );
  }

  if (calendar && asap === null) {
    return (
      <p className="text-[15px] text-muted-foreground">
        {t(
          "We're not taking pick-up orders at the moment. Please check back soon.",
          "我们目前不接受取货订单，请稍后再来。",
        )}
      </p>
    );
  }

  const modes = [
    { tab: "asap", label: t("ASAP", "尽快"), select: handleAsapSelect },
    {
      tab: "custom",
      label: t("Pick up later", "稍后取货"),
      select: handlePickLaterSelect,
    },
  ] as const;

  // A radio group: the arrow keys move the choice, and Tab leaves the group.
  const handleModeKey = (event: React.KeyboardEvent) => {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      return;
    }
    event.preventDefault();
    const next = selectedTab === "asap" ? 1 : 0;
    modes[next].select();
    modeRefs.current[next]?.focus();
  };

  const days = Array.from({ length: BOOKING_DAYS_AHEAD + 1 }, (_, i) =>
    addDaysToKey(todayKey, i),
  );

  return (
    <div className="flex flex-col gap-3.5 lg:gap-4">
      <div
        role="radiogroup"
        aria-label={t("Pick-up time", "取货时间")}
        onKeyDown={handleModeKey}
        className="flex w-full rounded-full bg-muted p-1 sm:w-[400px]"
      >
        {modes.map((mode, index) => {
          const checked = selectedTab === mode.tab;
          return (
            <button
              key={mode.tab}
              ref={(el) => {
                modeRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              disabled={!calendar}
              onClick={mode.select}
              className={cn(
                "h-11 flex-1 rounded-full text-[15px] font-semibold transition-colors disabled:opacity-50 lg:text-base",
                focusRing,
                checked && "bg-primary font-extrabold text-primary-foreground",
              )}
            >
              {mode.label}
            </button>
          );
        })}
      </div>

      {!calendar || !value ? (
        <p className="text-[15px] text-muted-foreground">
          {t("Loading pick-up times...", "正在加载取货时间...")}
        </p>
      ) : selectedTab === "asap" ? (
        <div className="flex items-start gap-3.5">
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary"
          >
            <Clock className="h-[22px] w-[22px]" strokeWidth={1.9} />
          </span>
          <div className="flex flex-col gap-0.5">
            <p className="text-lg font-extrabold tabular-nums lg:text-xl">
              {t("Estimated time: ", "预计时间：")}
              {/* Wraps whole, after the label, rather than leaving "pm" alone. */}
              <span className="whitespace-nowrap">
                {asap
                  ? pickUpTimeLabel(asap, language)
                  : t("Loading...", "加载中...")}
              </span>
            </p>
            <p className="text-[15px] text-muted-foreground">
              {asap && nzDayKey(asap) !== todayKey
                ? t(
                    "There are no pick-up times left today. The soonest is when we next open.",
                    "今天已没有可取货时间。最早可在下次营业时取货。",
                  )
                : t(
                    "Your order will be ready for pickup as soon as possible.",
                    "您的订单将尽快准备好供取货。",
                  )}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div
            ref={stripRef}
            role="group"
            aria-label={t("Pick-up day", "取货日期")}
            // A phone scrolls it sideways, to the screen's edge; the padding keeps each
            // day's focus ring inside the scroller, which clips. Wider screens wrap it
            // instead, since a mouse wheel cannot scroll it sideways and the days past
            // the column's edge would be out of reach.
            className="relative -mx-5 flex gap-2 overflow-x-auto px-5 py-1 scrollbar-hide sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:py-0"
          >
            {days.map((dayKey) => {
              const bookable = isBookableDay(dayKey);
              const chip = dayChip(dayKey, todayKey, bookable, language);
              const picked = dayKey === valueDayKey;
              return (
                <button
                  key={dayKey}
                  type="button"
                  aria-pressed={picked}
                  aria-label={chip.label}
                  disabled={!bookable}
                  onClick={() => handleDaySelect(dayKey)}
                  className={cn(
                    "flex h-[68px] w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-card bg-secondary transition-[filter] hover:brightness-95 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:hover:brightness-100",
                    focusRing,
                    picked &&
                      "bg-inverse text-inverse-foreground hover:brightness-100",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "text-xs font-bold",
                      picked && "text-secondary",
                    )}
                  >
                    {chip.weekday}
                  </span>
                  <span
                    aria-hidden
                    className="text-xl font-extrabold tabular-nums"
                  >
                    {chip.day}
                  </span>
                </button>
              );
            })}
          </div>

          {valueDayHours && valueDayKey && (
            <p className="text-sm tabular-nums text-muted-foreground">
              {hoursLine(valueDayKey, valueDayHours, language)}
            </p>
          )}

          <div
            ref={gridRef}
            role="group"
            aria-label={t("Pick-up times", "可取货时间")}
            className="grid grid-cols-3 gap-2 sm:grid-cols-4"
          >
            {shown.map((time) => {
              const picked = valueTime === time.getTime();
              return (
                <button
                  key={time.getTime()}
                  type="button"
                  aria-pressed={picked}
                  onClick={() => handleTimeSelect(time)}
                  className={cn(
                    "h-11 rounded-full bg-secondary text-[15px] font-semibold tabular-nums transition-[filter] hover:brightness-95",
                    focusRing,
                    picked && "bg-primary font-extrabold",
                  )}
                >
                  {timeOfDay(nzMinuteOfDay(time), language)}
                </button>
              );
            })}
            {slots.length === 0 && (
              <p className="col-span-full py-2 text-[15px] text-muted-foreground">
                {t(
                  "No pick-up times left on this date. Please select another date.",
                  "此日期没有可用时间。请选择其他日期。",
                )}
              </p>
            )}
          </div>

          {more && (
            <button
              type="button"
              onClick={() => {
                revealFrom.current = shown.length;
                setShowAllFor(valueDayKey);
              }}
              className={cn(
                "-my-1 flex h-11 items-center gap-1 self-start rounded-full text-[15px] font-bold text-accent hover:underline",
                focusRing,
              )}
            >
              {t("Later times", "更晚的时间")}
              <ChevronDown className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          )}
        </>
      )}
    </div>
  );
}
