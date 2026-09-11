import { addDays, addMinutes, set, getDay, isSameDay } from "date-fns";
import { BusinessHoursType, dayHoursType } from "./types";
import { customBusinessHours } from "./businessHours";
import { DateTime } from "luxon";
import { DEFAULT_PREP_TIMES, quoteMinutes, type PrepTimes } from "./prepTimes";

// Define business hours for each day of the week
// 0 = Sunday, 1 = Monday, ..., 6 = Saturday

export const getTodayNZ = () =>
  DateTime.now().setZone("Pacific/Auckland").startOf("day").toJSDate();

export const getNowNZ = () =>
  DateTime.now().setZone("Pacific/Auckland").toJSDate();

export const HOURS = customBusinessHours as BusinessHoursType;

// Check if a date is a business day (open)
export const isBusinessDay = (date: Date, daysOff: Date[]): boolean => {
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
  daysOff: Date[],
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

/**
 * How close to closing the counter still takes a pick-up order.
 *
 * Mirrors `LAST_ORDER_OFFSET_MINUTES.pickup` on the order server, which
 * rejects anything later. The two must agree or we offer slots it refuses.
 */
export const LAST_ORDER_OFFSET_MINUTES = 10;

/** The latest slot that can still be ordered on a given day. */
const lastOrderTime = (endDateTime: Date) =>
  new Date(endDateTime.getTime() - LAST_ORDER_OFFSET_MINUTES * 60 * 1000);

/**
 * Is this an instant the shop can actually serve on that day?
 *
 * A plain comparison of instants. The check this replaced compared the *minute
 * component* of the slot against the minute component of the opening and
 * closing times — so with a 12:30 open it only accepted slots whose minutes
 * were 30 to 39, and sent everything else back to the opening time. It also
 * compared `getHours()` against the fractional `open` (12.5), which rejected
 * the 12:30 slot itself.
 */
export const isWithinTradingWindow = (
  when: Date,
  dayHours: dayHoursType,
): boolean => {
  if (!dayHours || dayHours.open === null || dayHours.close === null) {
    return false;
  }

  const { startDateTime, endDateTime } = getStartEndHours(dayHours, when);

  return (
    when.getTime() >= startDateTime.getTime() &&
    when.getTime() <= lastOrderTime(endDateTime).getTime()
  );
};

/**
 * Is this slot sooner than the kitchen could have the order ready?
 *
 * The soonest we can promise depends on how big the order is, so a time that
 * was fine for two desserts stops being fine when a third and fourth are
 * added. Anything that checks "is this too early" has to ask this rather than
 * comparing against a fixed number of minutes, or the check silently only
 * holds for small orders.
 *
 * An unusable date counts as too soon, so it gets replaced rather than kept.
 */
export const isTooSoon = (
  pickUpTime: Date,
  numberOfItems: number,
  prepTimes: PrepTimes = DEFAULT_PREP_TIMES,
  now: Date = getNowNZ(),
): boolean => {
  const chosen = pickUpTime?.getTime?.();

  if (typeof chosen !== "number" || Number.isNaN(chosen)) return true;

  const earliest =
    now.getTime() + quoteMinutes(numberOfItems, prepTimes) * 60 * 1000;

  return chosen < earliest;
};

/**
 * Every slot that can still be ordered on `selectedDate`, ten minutes apart.
 *
 * Pure, and takes `now`, so the picker's behaviour can be tested rather than
 * only clicked through. Slots on the current day start no sooner than the
 * order actually takes to make — offering a customer a time the kitchen
 * cannot meet is how an order arrives late.
 */
export const getTimeSlots = (
  selectedDate: Date,
  {
    numberOfItems,
    prepTimes,
    now = getNowNZ(),
  }: { numberOfItems: number; prepTimes?: PrepTimes; now?: Date },
): Date[] => {
  const isToday = isSameDay(selectedDate, now);
  const dayHours = getBusinessHoursForDate(selectedDate);

  if (!dayHours || dayHours.open === null || dayHours.close === null) {
    return [];
  }

  const { startDateTime, endDateTime } = getStartEndHours(
    dayHours,
    selectedDate,
  );

  if (isToday && now >= endDateTime) return [];

  const leadMinutes = quoteMinutes(numberOfItems, prepTimes);

  let currentTime = new Date(startDateTime);

  // Start from the later of opening time and now.
  if (isToday && currentTime < now) {
    currentTime = new Date(now);
  }

  // Round up to the next ten-minute mark.
  const minutes = currentTime.getMinutes();
  currentTime.setMinutes(
    minutes % 10 === 0 ? minutes : minutes + (10 - (minutes % 10)),
    0,
    0,
  );

  const lastSlot = lastOrderTime(endDateTime);
  const slots: Date[] = [];

  while (currentTime <= lastSlot) {
    const minutesAway = (currentTime.getTime() - now.getTime()) / 1000 / 60;

    if (!isToday || minutesAway >= leadMinutes) {
      slots.push(new Date(currentTime));
    }

    currentTime = addMinutes(currentTime, 10);
  }

  return slots;
};

export const getNextValidTime = (
  numberOfItems: number,
  daysOff: Date[],
  prepTimes: PrepTimes = DEFAULT_PREP_TIMES,
) => {
  const now = getNowNZ();

  // Round to next 5 minutes
  // const minutes = now.getMinutes();
  // const remainder = minutes % 5;
  // const roundedMinutes = remainder === 0 ? minutes : minutes + (5 - remainder);

  let nextTime = new Date(now);
  // nextTime.setMinutes(roundedMinutes, 0, 0);
  // console.log(roundedMinutes);
  // Add preparation time. The shop sets these; with the defaults this is the
  // same 10 / 15 / 20 minutes the site has always quoted.
  nextTime.setMinutes(
    nextTime.getMinutes() + quoteMinutes(numberOfItems, prepTimes),
  );

  const dayHours = getBusinessHoursForDate(nextTime);

  const { startDateTime } = getStartEndHours(dayHours, now);
  // Check if we're closed today
  if (
    (dayHours && dayHours.open === null) ||
    !isBusinessDay(nextTime, daysOff)
  ) {
    // Find the next open date

    const nextOpenDate = findNextOpenDate(addDays(now, 1), daysOff);
    if (!nextOpenDate) return null;
    const { startDateTime } = getStartEndHours(dayHours, nextOpenDate);
    return set(nextOpenDate, {
      hours: startDateTime.getHours(),
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
    const nextOpenDate = findNextOpenDate(addDays(now, 1), daysOff);
    if (!nextOpenDate) return null;
    const { startDateTime } = getStartEndHours(dayHours, nextOpenDate);
    return set(nextOpenDate, {
      hours: startDateTime.getHours(),
      minutes: startDateTime.getMinutes(),
    });
  }

  return nextTime;
};
