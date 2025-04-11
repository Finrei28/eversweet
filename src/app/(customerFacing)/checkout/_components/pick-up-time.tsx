"use client";

import { useState, useEffect } from "react";
import { format, addDays, set, isAfter, isBefore, getDay } from "date-fns";
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
import { customBusinessHours } from "~/lib/businessHours";
import { useLanguage } from "~/app/components/language";
import { zhCN, enNZ } from "date-fns/locale";

// Define business hours for each day of the week
// 0 = Sunday, 1 = Monday, ..., 6 = Saturday
type BusinessHoursType = {
  [key: number]: {
    open: number | null; // null means closed
    close: number | null;
    displayName: string;
  };
};

interface PickupTimeProps {
  onChange: (date: Date | null) => void;
  value: Date | null;
  setPickUpNextOpening: (boolean: boolean) => void;
  pickUpNextOpening: boolean;
  // Optional custom business hours
}

type dayHoursType = {
  open: number | null;
  close: number | null;
  displayName: string;
};

const HOURS = customBusinessHours as BusinessHoursType;

// Check if a date is a business day (open)
const isBusinessDay = (date: Date): boolean => {
  const day = getDay(date);
  return HOURS[day]?.open !== null;
};

// Get business hours for a specific date
const getBusinessHoursForDate = (date: Date) => {
  const day = getDay(date);
  return HOURS[day] as dayHoursType;
};

// Find the next open date
const findNextOpenDate = (startDate: Date): Date => {
  let date = new Date(startDate);
  let daysChecked = 0;

  // Prevent infinite loop by checking up to 14 days
  while (!isBusinessDay(date) && daysChecked < 14) {
    date = addDays(date, 1);
    daysChecked++;
  }

  return date;
};

const convertFractionalHour = (hour: number): [number, number] => {
  const h = Math.floor(hour);
  const m = (hour - h) * 60;
  return [h, Math.round(m)];
};

const getStartEndHours = (dayHours: dayHoursType, selectedDate: Date) => {
  const [openHour, openMinute] = convertFractionalHour(dayHours.open as number);
  const [closeHour, closeMinute] = convertFractionalHour(
    dayHours.close as number,
  );

  const startDateTime = set(new Date(selectedDate), {
    hours: openHour,
    minutes: openMinute,
  });

  const endDateTime = set(new Date(selectedDate), {
    hours: closeHour,
    minutes: closeMinute,
  });

  return { startDateTime, endDateTime };
};

export const getNextValidTime = () => {
  const now = new Date();

  // Round to next 5 minutes
  // const minutes = now.getMinutes();
  // const remainder = minutes % 5;
  // const roundedMinutes = remainder === 0 ? minutes : minutes + (5 - remainder);

  let nextTime = new Date(now);
  // nextTime.setMinutes(roundedMinutes, 0, 0);
  // console.log(roundedMinutes);
  // Add 10 minutes for preparation time
  nextTime.setMinutes(nextTime.getMinutes() + 10);

  const dayHours = getBusinessHoursForDate(nextTime);

  const { startDateTime } = getStartEndHours(dayHours, now);

  // Check if we're closed today
  if (dayHours && dayHours.open === null) {
    // Find the next open date

    const nextOpenDate = findNextOpenDate(addDays(now, 1));
    const { startDateTime } = getStartEndHours(dayHours, nextOpenDate);
    return set(nextOpenDate, {
      hours: HOURS[getDay(nextOpenDate)]?.open || 12,
      minutes: startDateTime.getMinutes(),
    });
  }

  // Check if within business hours
  if (dayHours && dayHours.open && nextTime.getHours() < dayHours.open) {
    // Before opening, set to opening time
    nextTime = set(nextTime, {
      hours: dayHours.open,
      minutes: startDateTime.getMinutes(),
    });
  } else if (dayHours && nextTime.getHours() >= (dayHours.close || 21)) {
    // After closing, find the next open date
    const nextOpenDate = findNextOpenDate(addDays(now, 1));
    const { startDateTime } = getStartEndHours(dayHours, nextOpenDate);
    return set(nextOpenDate, {
      hours: HOURS[getDay(nextOpenDate)]?.open || 12,
      minutes: startDateTime.getMinutes(),
    });
  }

  return nextTime;
};

export function PickupTimePicker({
  onChange,
  value,
  setPickUpNextOpening,
  pickUpNextOpening,
}: PickupTimeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"asap" | "custom">("asap");
  const { language } = useLanguage();

  // Get the next valid time (rounded to nearest 15 minutes)

  useEffect(() => {
    const interval = setInterval(() => {
      if (!value) return;
      const now = new Date();
      const diffInMs = value.getTime() - now.getTime();
      const diffInMinutes = diffInMs / 1000 / 60;
      const nextTime = getNextValidTime();
      if (diffInMinutes < 10) {
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
    }, 10000); // check every 10 seconds

    return () => clearInterval(interval);
  }, [value]);

  // Generate time slots for the selected date
  const generateTimeSlots = (selectedDate: Date) => {
    const now = new Date();
    const isToday =
      selectedDate.getDate() === now.getDate() &&
      selectedDate.getMonth() === now.getMonth() &&
      selectedDate.getFullYear() === now.getFullYear();

    const dayHours = getBusinessHoursForDate(selectedDate);

    if (!dayHours || dayHours.open === null || dayHours.close === null) {
      return [];
    }

    const { startDateTime, endDateTime } = getStartEndHours(
      dayHours,
      selectedDate,
    );

    if (isToday && now >= endDateTime) {
      return [];
    }

    const slots = [];
    let currentTime = new Date(startDateTime);

    // Start from max of now or business start time
    if (isToday && currentTime < now) {
      currentTime = new Date(Math.max(currentTime.getTime(), now.getTime()));
    }

    // Round currentTime to next 10-minute interval
    const minutes = currentTime.getMinutes();
    const roundedMinutes =
      minutes % 10 === 0 ? minutes : minutes + (10 - (minutes % 10));
    currentTime.setMinutes(roundedMinutes, 0, 0);

    const endDateTimeBeforeFifteenminutes = new Date(
      endDateTime.getTime() - 20 * 60 * 1000,
    );

    while (currentTime < endDateTimeBeforeFifteenminutes) {
      const diff = (currentTime.getTime() - now.getTime()) / 1000 / 60; // in minutes
      if (!isToday || diff >= 10) {
        slots.push(new Date(currentTime));
      }
      currentTime.setMinutes(currentTime.getMinutes() + 10);
    }

    return slots;
  };

  // Helper to convert 12.5 -> [12, 30]

  // Set initial value if not provided
  useEffect(() => {
    if (!value) {
      onChange(getNextValidTime());
    }
  }, [value, onChange]);

  // Handle ASAP selection
  const handleAsapSelect = () => {
    setSelectedTab("asap");
    onChange(getNextValidTime());
    setIsOpen(false);
  };

  // Handle date selection
  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;

    setSelectedTab("custom");

    // Check if the selected date is a business day
    if (!isBusinessDay(date)) {
      // Find the next open date
      const nextOpenDate = findNextOpenDate(date);
      onChange(
        set(nextOpenDate, {
          hours: HOURS[getDay(nextOpenDate)]?.open || 12,
          minutes: 0,
        }),
      );
      return;
    }

    const dayHours = getBusinessHoursForDate(date);
    const { startDateTime, endDateTime } = getStartEndHours(dayHours, date);

    // Keep the same time if possible, otherwise set to opening time
    if (value) {
      const newDate = new Date(date);
      newDate.setHours(value.getHours(), value.getMinutes());

      // Validate the time is within business hours
      if (
        dayHours?.open !== null &&
        dayHours?.close !== null &&
        newDate.getHours() >= (dayHours?.open as number) &&
        newDate.getHours() < (dayHours?.close as number) &&
        newDate.getMinutes() >= startDateTime.getMinutes() &&
        newDate.getMinutes() < endDateTime.getMinutes()
      ) {
        onChange(newDate);
        return;
      }
    }

    // Default to opening time

    onChange(
      set(date, {
        hours: startDateTime.getHours() || 12,
        minutes: startDateTime.getMinutes(),
      }),
    );
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
              <TabsTrigger value="custom">
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
                  ? format(getNextValidTime(), "EEE, h:mm a", {
                      locale: language === "en" ? enNZ : zhCN,
                    })
                  : "Loading..."}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="custom" className="p-0">
            <div className="flex flex-col md:flex-row">
              <div className="w-full md:w-auto">
                <Calendar
                  mode="single"
                  locale={language === "en" ? enNZ : zhCN}
                  selected={value || undefined}
                  onSelect={handleDateSelect}
                  disabled={(date) => {
                    const now = new Date();
                    // Disable past dates, dates more than 2 weeks in the future, and closed days
                    return (
                      isBefore(date, new Date(now.setHours(0, 0, 0, 0))) ||
                      isAfter(date, addDays(new Date(), 14)) ||
                      !isBusinessDay(date)
                    );
                  }}
                  modifiers={{
                    closed: (date) => !isBusinessDay(date),
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
                    {value && isBusinessDay(value) ? (
                      generateTimeSlots(value).map((time, i) => (
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
                      ))
                    ) : value ? (
                      <p className="col-span-2 py-4 text-center text-sm text-muted-foreground">
                        {language === "en"
                          ? "We're closed on this day. Please select another date."
                          : "我们今天休息。请选择其他日期."}
                      </p>
                    ) : null}
                    {value &&
                      isBusinessDay(value) &&
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
