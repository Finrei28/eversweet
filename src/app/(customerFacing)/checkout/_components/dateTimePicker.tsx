"use client";

import * as React from "react";
import { format, addMonths } from "date-fns";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { ScrollArea, ScrollBar } from "~/components/ui/scroll-area";
import { CalendarIcon } from "lucide-react";
import { useEffect } from "react";
import { useLanguage } from "~/app/components/language";

type DateTimePickerProps = {
  pickUpTime: Date;
  setPickUpTime: React.Dispatch<React.SetStateAction<Date>>;
  getNextValidTime: () => Date;
  setASAP: React.Dispatch<React.SetStateAction<boolean>>;
  ASAP: boolean;
};

export function DateTimePicker({
  pickUpTime,
  setPickUpTime,
  getNextValidTime,
  setASAP,
  ASAP,
}: DateTimePickerProps) {
  const { language } = useLanguage();
  const [availableDates, setAvailableDates] =
    React.useState(getNextValidTime());
  const [isOpen, setIsOpen] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState<Date>(new Date());
  const [pickUpTimeChanged, setPickUpTimeChanged] = React.useState(false);

  // Allowed hours (12 AM - 9 PM)
  const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);
    return () => clearInterval(interval);
  }, []);
  const sameMonthDayHour =
    pickUpTime.getMonth() === currentTime.getMonth() &&
    pickUpTime.getDate() === currentTime.getDate() &&
    pickUpTime.getHours() === currentTime.getHours();

  const isNextHour =
    pickUpTime.getMonth() === currentTime.getMonth() &&
    pickUpTime.getDate() === currentTime.getDate() &&
    pickUpTime.getHours() - 1 === currentTime.getHours();

  const withinBusinessHours =
    currentTime.getHours() < 21 && currentTime.getHours() >= 12;

  const sameMonthDay =
    pickUpTime.getMonth() === currentTime.getMonth() &&
    pickUpTime.getDate() === currentTime.getDate();
  useEffect(() => {
    if (
      ((currentTime.getMinutes() + 10 >= pickUpTime.getMinutes() &&
        currentTime.getMinutes() + 10 <= 50 &&
        sameMonthDayHour) ||
        (currentTime.getMinutes() + 10 >= pickUpTime.getMinutes() + 60 &&
          isNextHour)) &&
      withinBusinessHours
    ) {
      setPickUpTime(getNextValidTime());
    }
    if (
      (currentTime.getMinutes() + 10 >= availableDates.getMinutes() &&
        currentTime.getMinutes() + 10 <= 50) ||
      currentTime.getMinutes() + 10 >= availableDates.getMinutes() + 60
    ) {
      setAvailableDates(getNextValidTime());
    }
  }, [currentTime, pickUpTime]);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const isSelectedSameMonthDay =
        selectedDate.getMonth() === currentTime.getMonth() &&
        selectedDate.getDate() === currentTime.getDate();
      setPickUpTimeChanged(true);
      setASAP(false);
      setPickUpTime(() =>
        isSelectedSameMonthDay
          ? new Date(
              selectedDate.setHours(
                availableDates.getHours(),
                availableDates.getMinutes(),
              ),
            )
          : new Date(selectedDate.setHours(12, 0)),
      );
    }
  };

  const handleTimeChange = (type: "hour" | "minute", value: string) => {
    if (pickUpTime) {
      setPickUpTimeChanged(true);
      setASAP(false);
      const newDate = new Date(pickUpTime);

      if (type === "hour") {
        const hour = parseInt(value);
        newDate.setHours(hour < 10 ? hour + 12 : hour); // Adjust PM hours to 24 hour values
      } else if (type === "minute") {
        newDate.setMinutes(parseInt(value));
      }

      setPickUpTime(newDate);
    }
  };

  const isPastDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set time to midnight to exclude today
    return date < today;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !pickUpTime && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {pickUpTimeChanged ? (
            format(pickUpTime, "dd/MM/yyyy hh:mm aa")
          ) : (
            <span>{language === "en" ? "Pick up ASAP" : "尽快取货"}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <div className="sm:flex">
          <Calendar
            mode="single"
            selected={pickUpTime}
            onSelect={handleDateSelect}
            initialFocus
            disabled={(pickUpTime) =>
              isPastDate(pickUpTime) || pickUpTime > addMonths(new Date(), 2)
            }
          />
          <div className="flex flex-col divide-y sm:h-[300px] sm:flex-row sm:divide-x sm:divide-y-0">
            {/* Hours Selection (10 AM - 6 PM) */}
            <ScrollArea className="w-64 sm:w-auto">
              <div className="flex p-2 sm:flex-col">
                {hours.map((hour) => {
                  return (
                    <Button
                      key={hour}
                      size="icon"
                      variant={
                        pickUpTime && pickUpTime.getHours() % 12 === hour % 12
                          ? "default"
                          : "ghost"
                      }
                      className={`aspect-square shrink-0 sm:w-full ${(hour < 10 ? availableDates.getHours() > hour + 12 : availableDates.getHours() > hour) && sameMonthDay && "hidden"}`}
                      onClick={() => handleTimeChange("hour", hour.toString())}
                      disabled={
                        hour < 12
                          ? hour + 12 < currentTime.getHours() && sameMonthDay
                          : hour < currentTime.getHours() && sameMonthDay
                      }
                    >
                      {hour}
                    </Button>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" className="sm:hidden" />
            </ScrollArea>

            {/* Minutes Selection (Every 15 minutes) */}
            <ScrollArea className="w-64 sm:w-auto">
              <div className="flex p-2 sm:flex-col">
                {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => {
                  const isNextValidTimeInSameCurrentHour =
                    availableDates.getMinutes() > minute && sameMonthDayHour;
                  const isNextValidTimeInNextHour =
                    currentTime.getMinutes() >= 50 &&
                    availableDates.getMinutes() > minute &&
                    sameMonthDay &&
                    currentTime.getHours() === availableDates.getHours() - 1;

                  return (
                    <Button
                      key={minute}
                      size="icon"
                      variant={
                        pickUpTime &&
                        pickUpTime.getMinutes() === minute &&
                        !ASAP
                          ? "default"
                          : "ghost"
                      }
                      className={`aspect-square shrink-0 sm:w-full ${(isNextValidTimeInSameCurrentHour || isNextValidTimeInNextHour) && "hidden"}`}
                      onClick={() =>
                        handleTimeChange("minute", minute.toString())
                      }
                      disabled={
                        availableDates.getMinutes() > minute && sameMonthDayHour
                      }
                    >
                      {minute}
                    </Button>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" className="sm:hidden" />
            </ScrollArea>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
