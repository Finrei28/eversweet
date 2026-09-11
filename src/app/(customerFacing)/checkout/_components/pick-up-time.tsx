"use client";

import { useState, useEffect, useRef } from "react";
import {
  format,
  addDays,
  set,
  isAfter,
  isBefore,
  getDay,
  isSameDay,
  addMinutes,
} from "date-fns";
import { Calendar } from "~/components/ui/calendar";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { CalendarIcon, Clock, Info } from "lucide-react";
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
import { zhCN, enNZ } from "date-fns/locale";
import {
  findNextOpenDate,
  getBusinessHoursForDate,
  getNextValidTime,
  getNowNZ,
  getStartEndHours,
  getTimeSlots,
  getTodayNZ,
  HOURS,
  isBusinessDay,
  isTooSoon,
  isWithinTradingWindow,
} from "~/lib/pickUpTimeHelper";
import { quoteMinutes } from "~/lib/prepTimes";
import { DateTime } from "luxon";
import { api } from "~/trpc/react";

type PickupTimeProps = {
  onChange: (date: Date | null) => void;
  value: Date | null;
  setPickUpNextOpening: (boolean: boolean) => void;
  pickUpNextOpening: boolean;
  numberOfItems: number;
  daysOff: Date[];
};

export function PickupTimePicker({
  onChange,
  value,
  setPickUpNextOpening,
  pickUpNextOpening,
  numberOfItems,
  daysOff,
}: PickupTimeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"asap" | "custom">("asap");
  const { language } = useLanguage();
  // Shared with the kitchen, so the slot offered here and the moment staff are
  // told to start it come from the same row. React Query de-dupes this with
  // the checkout form's own copy.
  const { data: prepTimes } = api.store.getPrepTimes.useQuery();

  // Get the next valid time (rounded to nearest 15 minutes)

  useEffect(() => {
    const interval = setInterval(() => {
      if (!value) return;
      const now = getNowNZ();
      const nextTime = getNextValidTime(numberOfItems, daysOff, prepTimes);
      if (!nextTime) return;
      // Was a fixed ten minutes, which is only the right threshold for a small
      // order — a six item order needs fifteen, and was left sitting on a time
      // the kitchen could not meet until it fell inside ten.
      if (isTooSoon(value, numberOfItems, prepTimes, now)) {
        onChange(nextTime);
      }
      if (!pickUpNextOpening) {
        const isToday =
          nextTime.getDate() === now.getDate() &&
          nextTime.getMonth() === now.getMonth() &&
          nextTime.getFullYear() === now.getFullYear();
        if (!isToday) {
          setPickUpNextOpening(true);
        }
      }
    }, 5000); // check every 5 seconds

    return () => clearInterval(interval);
  }, [
    value,
    onChange,
    pickUpNextOpening,
    setPickUpNextOpening,
    numberOfItems,
    daysOff,
    prepTimes,
  ]);

  /**
   * The cart changed size, so the soonest we can have it ready moved with it.
   *
   * Nothing used to react to this: the time was worked out once and then only
   * revisited when it fell inside a fixed ten minute window. Adding a fourth
   * dessert pushes the quote from ten minutes to fifteen, and the time on
   * screen stayed where it was.
   *
   * Keyed on the quote rather than the raw count, so going from two items to
   * three — which does not change what we can promise — moves nothing.
   */
  const lastQuoteRef = useRef<number | null>(null);

  useEffect(() => {
    const quote = quoteMinutes(numberOfItems, prepTimes);
    const previousQuote = lastQuoteRef.current;
    lastQuoteRef.current = quote;

    // First run only records where we started.
    if (previousQuote === null || previousQuote === quote || !value) return;

    // ASAP means as soon as possible, so it follows the quote in both
    // directions. A time the customer chose for themselves is only moved when
    // it has become sooner than we can actually make the order.
    if (selectedTab !== "asap" && !isTooSoon(value, numberOfItems, prepTimes)) {
      return;
    }

    const nextTime = getNextValidTime(numberOfItems, daysOff, prepTimes);
    if (nextTime) onChange(nextTime);
  }, [numberOfItems, prepTimes, value, selectedTab, daysOff, onChange]);

  // Lives in pickUpTimeHelper so it can be tested directly, and so the slots
  // offered here respect the same preparation times the kitchen works to.
  const generateTimeSlots = (selectedDate: Date) =>
    getTimeSlots(selectedDate, { numberOfItems, prepTimes });

  // Set initial value if not provided
  useEffect(() => {
    if (!value) {
      onChange(getNextValidTime(numberOfItems, daysOff, prepTimes));
    }
  }, [value, onChange]);

  // Handle ASAP selection
  const handleAsapSelect = () => {
    setSelectedTab("asap");
    onChange(getNextValidTime(numberOfItems, daysOff, prepTimes));
    setIsOpen(false);
  };

  // Handle date selection
  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const nzDate = DateTime.fromJSDate(date)
      .setZone("Pacific/Auckland", { keepLocalTime: true })
      .startOf("day")
      .toJSDate();

    setSelectedTab("custom");

    // Check if the selected date is a business day
    if (!isBusinessDay(nzDate, daysOff)) {
      // Find the next open date
      onChange(getNextValidTime(numberOfItems, daysOff, prepTimes));
      return;
    }

    const dayHours = getBusinessHoursForDate(nzDate);
    const { startDateTime } = getStartEndHours(dayHours, nzDate);

    // The earliest slot still orderable on that day. On today this already
    // accounts for how long the order takes to make.
    const firstTimeSlot = generateTimeSlots(nzDate)[0];

    if (firstTimeSlot && isWithinTradingWindow(firstTimeSlot, dayHours)) {
      onChange(firstTimeSlot);
      return;
    }

    // Nothing left today — offer opening time on the day they picked so the
    // calendar still moves, rather than leaving the old time in place.
    onChange(
      set(nzDate, {
        hours: startDateTime.getHours() || 12,
        minutes: startDateTime.getMinutes(),
      }),
    );
  };

  /**
   * Switching from ASAP to "Pick up later".
   *
   * Seeds with the same slot ASAP would give, so the time on screen does not
   * jump when the customer only meant to open the calendar. It used to run the
   * date-select path against today, whose broken hours check sent almost every
   * slot back to the opening time — 12:30, hours in the past.
   */
  const handlePickLaterSelect = () => {
    setSelectedTab("custom");

    const nextValid = getNextValidTime(numberOfItems, daysOff, prepTimes);
    if (nextValid) onChange(nextValid);
  };

  // Handle time selection
  const handleTimeSelect = (time: Date) => {
    onChange(time);
    setIsOpen(false);
  };

  // Format the display value
  const formatDisplayValue = () => {
    if (!value)
      return language === "en" ? "Select pickup time" : "选择取货时间";

    if (selectedTab === "asap") {
      return (
        (language === "en" ? "ASAP (approx. " : "尽快 (大概 ") +
        format(value, "EEE, h:mm a", {
          locale: language === "en" ? enNZ : zhCN,
        }) +
        ")"
      );
    }

    return format(value, "EEE, MMM d, h:mm a", {
      locale: language === "en" ? enNZ : zhCN,
    });
  };

  const formatFractionalHour = (hour: number): string => {
    const h = Math.floor(hour);
    const m = Math.round((hour - h) * 60);
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    const minutes = m.toString().padStart(2, "0");
    return `${hour12}:${minutes} ${period}`;
  };

  // Get business hours display for a date
  const getBusinessHoursDisplay = (date: Date) => {
    const dayHours = getBusinessHoursForDate(date);

    if (dayHours?.open === null) {
      return "Closed";
    }

    const openTimeStr = formatFractionalHour(dayHours.open);
    const closeTimeStr = formatFractionalHour(dayHours?.close as number);

    return `${openTimeStr} - ${closeTimeStr}`;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
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
          defaultValue={selectedTab}
          onValueChange={(v) => setSelectedTab(v as "asap" | "custom")}
        >
          <div className="border-b p-3">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="asap" onClick={handleAsapSelect}>
                {language === "en" ? "ASAP" : "尽快"}
              </TabsTrigger>
              <TabsTrigger value="custom" onClick={handlePickLaterSelect}>
                {language === "en" ? "Pick up later" : "稍后取货"}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="asap" className="p-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {language === "en"
                  ? "Your order will be ready for pickup as soon as possible."
                  : "您的订单将尽快准备好供取货."}
              </p>
              <p className="font-medium">
                {language === "en" ? "Estimated time: " : "预计时间: "}
                {value
                  ? format(
                      getNextValidTime(numberOfItems, daysOff, prepTimes) ?? "",
                      "EEE, h:mm a",
                      {
                        locale: language === "en" ? enNZ : zhCN,
                      },
                    )
                  : "Loading..."}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="custom" className="p-0">
            <div className="flex flex-col md:flex-row">
              <div className="w-full md:w-auto">
                <Calendar
                  mode="single"
                  locale={enNZ}
                  selected={value || undefined}
                  onSelect={handleDateSelect}
                  disabled={(date) => {
                    // Disable past dates, dates more than 2 weeks in the future, and closed days
                    return (
                      isBefore(date, getTodayNZ()) ||
                      isAfter(date, addDays(getNowNZ(), 14)) ||
                      !isBusinessDay(date, daysOff)
                    );
                  }}
                  modifiers={{
                    closed: (date) => !isBusinessDay(date, daysOff),
                  }}
                  modifiersClassNames={{
                    closed: "text-red-500 line-through opacity-50",
                  }}
                  initialFocus
                  className="flex justify-center border-r"
                />
                {value && (
                  <div className="border-t p-2 text-center text-sm">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex cursor-help items-center justify-center gap-1">
                            <span>
                              {language === "en" ? "Hours: " : "开门时间: "}
                              {getBusinessHoursDisplay(value)}
                            </span>
                            <Info className="h-3 w-3" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {language === "en"
                              ? "Business hours for "
                              : "营业时间为"}
                            {format(value, "EEEE", {
                              locale: language === "en" ? enNZ : zhCN,
                            })}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              </div>

              <div className="w-full p-3 sm:w-[200px]">
                <h3 className="mb-2 text-sm font-medium">
                  {language === "en" ? "Available Times" : "可取货时间"}
                </h3>
                <ScrollArea className="h-72">
                  <div className="grid grid-cols-2 gap-2 pr-3">
                    {value && isBusinessDay(value, daysOff) ? (
                      generateTimeSlots(value).map((time, i) => {
                        return (
                          <Button
                            key={i}
                            variant={
                              value && time.getTime() === value.getTime()
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            onClick={() => handleTimeSelect(time)}
                          >
                            {format(time, "h:mm a")}
                          </Button>
                        );
                      })
                    ) : value ? (
                      <p className="col-span-2 py-4 text-center text-sm text-muted-foreground">
                        {language === "en"
                          ? "We're closed on this day. Please select another date."
                          : "我们今天休息。请选择其他日期."}
                      </p>
                    ) : null}
                    {value &&
                      isBusinessDay(value, daysOff) &&
                      generateTimeSlots(value).length === 0 && (
                        <p className="col-span-2 py-4 text-center text-sm text-muted-foreground">
                          {language === "en"
                            ? "No available times for this date. Please select another date."
                            : "此日期没有可用时间。请选择其他日期."}
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
