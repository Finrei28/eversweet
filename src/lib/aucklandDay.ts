import { DateTime } from "luxon";

/**
 * Calendar days, for the admin's date pickers.
 *
 * A calendar control hands back midnight in the *browser's* timezone, and only the browser
 * knows which day that was. The server runs in UTC, where a click on 31 October in Auckland
 * is still 30 October - so reading the day off that `Date` on the server stores every
 * picked date a day early. That is how an offer set to end on the 31st stopped at midnight
 * at the start of it, and a prize to be collected by the 31st died at the end of the 30th.
 *
 * So a picked date crosses the wire as the day the admin saw ("2026-10-31"), read in the
 * browser, and the server turns that into an instant on the Auckland calendar, where the
 * host's timezone cannot move it.
 */

const ZONE = "Pacific/Auckland";

/**
 * The day a calendar `Date` shows: "2026-10-31".
 *
 * **Browser only.** It reads the date in whatever zone it runs in, which is the point in
 * the browser and the bug on the server.
 */
export const pickedDay = (date: Date): string =>
  DateTime.fromJSDate(date).toFormat("yyyy-LL-dd");

/**
 * The Auckland day a stored instant falls on, as the local-midnight `Date` a calendar
 * control shows for it. **Browser only**, like `pickedDay`, which it round-trips with.
 *
 * Without it an edit form shows the stored instant in the browser's zone: fine in
 * Auckland, and a day out for an admin somewhere else, who would then save that day.
 */
export const calendarDate = (instant: Date): Date =>
  DateTime.fromFormat(
    DateTime.fromJSDate(instant).setZone(ZONE).toFormat("yyyy-LL-dd"),
    "yyyy-LL-dd",
  ).toJSDate();

/** The first instant of a day in Auckland: when something dated from that day starts. */
export const startOfDayNZ = (day: string): Date =>
  DateTime.fromISO(day, { zone: ZONE }).startOf("day").toJSDate();

/**
 * The last instant of a day in Auckland: when something dated to that day ends.
 *
 * The last rather than the first, so the thing is live *through* the day named. Both
 * apps compare end dates inclusively, so this millisecond still counts.
 */
export const endOfDayNZ = (day: string): Date =>
  DateTime.fromISO(day, { zone: ZONE }).endOf("day").toJSDate();
