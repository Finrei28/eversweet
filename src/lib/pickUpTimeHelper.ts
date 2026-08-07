import { addDays, set, getDay, isSameDay } from "date-fns";
import { BusinessHoursType, dayHoursType } from "./types";
import { customBusinessHours } from "./businessHours";
import { DateTime } from "luxon";

// Define business hours for each day of the week
// 0 = Sunday, 1 = Monday, ..., 6 = Saturday

export const getTodayNZ = () =>
  DateTime.now().setZone("Pacific/Auckland").startOf("day").toJSDate();

export const getNowNZ = () =>
  DateTime.now().setZone("Pacific/Auckland").toJSDate();

export const HOURS = customBusinessHours as BusinessHoursType;

// Check if a date is a business day (open)
export const isBusinessDay = (date: Date, daysOff?: Date[]): boolean => {
  // Check if the date is in the daysOff array
  if (daysOff?.some((day) => isSameDay(day, date))) {
    return false;
  }

  const day = getDay(date);
  return HOURS[day]?.open !== null;
};

// Get business hours for a specific date
export const getBusinessHoursForDate = (date: Date) => {
  const day = getDay(date);
  return HOURS[day] as dayHoursType;
};

// Find the next open date
export const findNextOpenDate = (
  startDate: Date,
  daysOff?: Date[],
): Date | null => {
  let date = new Date(startDate);
  let daysChecked = 0;

  // Prevent infinite loop by checking up to 14 days
  while (!isBusinessDay(date, daysOff) && daysChecked < 14) {
    if (daysChecked >= 7) {
      return null;
    }
    date = addDays(date, 1);
    daysChecked++;
  }

  return date;
};

// Helper to convert 12.5 -> [12, 30]
export const convertFractionalHour = (hour: number): [number, number] => {
  const h = Math.floor(hour);
  const m = (hour - h) * 60;
  return [h, Math.round(m)];
};

export const getStartEndHours = (
  dayHours: dayHoursType,
  selectedDate: Date,
) => {
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

export const getNextValidTime = (numberOfItems: number) => {
  const now = getNowNZ();

  // Round to next 5 minutes
  // const minutes = now.getMinutes();
  // const remainder = minutes % 5;
  // const roundedMinutes = remainder === 0 ? minutes : minutes + (5 - remainder);

  let nextTime = new Date(now);
  // nextTime.setMinutes(roundedMinutes, 0, 0);
  // console.log(roundedMinutes);
  // Add preparation time
  let prepTime = 20; // default to item count > 6, taking 20 minutes to prepare
  if (numberOfItems <= 3) prepTime = 10;
  else if (numberOfItems <= 6) prepTime = 15;
  nextTime.setMinutes(nextTime.getMinutes() + prepTime);

  const dayHours = getBusinessHoursForDate(nextTime);

  const { startDateTime } = getStartEndHours(dayHours, now);

  // Check if we're closed today
  if (dayHours && dayHours.open === null) {
    // Find the next open date

    const nextOpenDate = findNextOpenDate(addDays(now, 1));
    if (!nextOpenDate) return null;
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
    if (!nextOpenDate) return null;
    const { startDateTime } = getStartEndHours(dayHours, nextOpenDate);
    return set(nextOpenDate, {
      hours: HOURS[getDay(nextOpenDate)]?.open || 12,
      minutes: startDateTime.getMinutes(),
    });
  }

  return nextTime;
};
