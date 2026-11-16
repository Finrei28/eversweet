/**
 * Days off as /admin/settings edits them: Auckland calendar days, "2026-12-25".
 *
 * A day off is a day, not an instant. The server stores each as Auckland midnight and every
 * reader - this site's checkout, the order server, the customer app - matches them by
 * Auckland calendar day, so the browser never handles one as a `Date` except to draw the
 * calendar (`pickedDay` and `dayAsCalendarDate` in `~/lib/aucklandDay`).
 */

/**
 * What the admin has changed and not yet saved: days picked, and saved days taken off.
 *
 * Held as a change rather than as the whole selection, because the list under it moves -
 * the query refetches on focus, and the staff app's tablets edit the same days. A selection
 * copied from the list when the card opened would read a day added since as one this admin
 * had taken off, and a save of it would delete that day.
 */
export type DaysOffEdit = {
  added: ReadonlySet<string>;
  removed: ReadonlySet<string>;
};

export const NO_EDIT: DaysOffEdit = { added: new Set(), removed: new Set() };

/** Whether a day shows as off: saved or picked, and not taken off. */
export const isOffInEdit = (
  day: string,
  saved: ReadonlySet<string>,
  edit: DaysOffEdit,
): boolean => (saved.has(day) || edit.added.has(day)) && !edit.removed.has(day);

/**
 * The edit after a click on `day`: off if it showed as open, open if it showed as off.
 *
 * Decided by what the day shows, against the list as it now stands. Decided by the edit
 * alone, a day this admin picked that someone else has since saved would stay off when
 * clicked, because unpicking it only undid the pick.
 */
export const toggleDayOff = (
  day: string,
  saved: ReadonlySet<string>,
  edit: DaysOffEdit,
): DaysOffEdit => {
  const added = new Set(edit.added);
  const removed = new Set(edit.removed);

  if (isOffInEdit(day, saved, edit)) {
    added.delete(day);
    if (saved.has(day)) removed.add(day);
  } else {
    removed.delete(day);
    if (!saved.has(day)) added.add(day);
  }

  return { added, removed };
};

/**
 * What a save sends: the days to close and to reopen, against the list as it now stands,
 * in calendar order. A change the list already has is left out, so the count on the Save
 * button is only this admin's.
 */
export const pendingDaysOff = (
  saved: ReadonlySet<string>,
  edit: DaysOffEdit,
): { added: string[]; removed: string[] } => ({
  added: [...edit.added].filter((day) => !saved.has(day)).sort(),
  removed: [...edit.removed].filter((day) => saved.has(day)).sort(),
});

const DAY_FORMATS = {
  en: new Intl.DateTimeFormat("en-NZ", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }),
  zh: new Intl.DateTimeFormat("zh-CN", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }),
};

/**
 * "Fri, 25 Dec 2026". Formatted as midnight UTC in UTC, which names the date given wherever
 * it runs: a calendar day has no zone, and formatted in the browser's own, an admin west of
 * UTC would see Christmas Eve.
 */
export const formatDayOff = (day: string, language: "en" | "zh"): string =>
  DAY_FORMATS[language].format(new Date(`${day}T00:00:00.000Z`));
