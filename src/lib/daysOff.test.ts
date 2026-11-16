import { describe, expect, it } from "vitest";

import {
  formatDayOff,
  isOffInEdit,
  NO_EDIT,
  pendingDaysOff,
  toggleDayOff,
  type DaysOffEdit,
} from "~/lib/daysOff";

const saved = (...days: string[]) => new Set(days);
const edit = (added: string[] = [], removed: string[] = []): DaysOffEdit => ({
  added: new Set(added),
  removed: new Set(removed),
});

describe("toggleDayOff", () => {
  it("picks a day that is not off", () => {
    const next = toggleDayOff("2026-12-25", saved(), NO_EDIT);
    expect(pendingDaysOff(saved(), next)).toEqual({
      added: ["2026-12-25"],
      removed: [],
    });
  });

  it("reopens a saved day off, and a second click puts it back", () => {
    const days = saved("2026-12-25");
    const reopened = toggleDayOff("2026-12-25", days, NO_EDIT);
    expect(pendingDaysOff(days, reopened)).toEqual({
      added: [],
      removed: ["2026-12-25"],
    });

    const back = toggleDayOff("2026-12-25", days, reopened);
    expect(pendingDaysOff(days, back)).toEqual({ added: [], removed: [] });
  });

  it("unpicks a day it had picked rather than marking it for removal", () => {
    const picked = toggleDayOff("2026-12-25", saved(), NO_EDIT);
    const unpicked = toggleDayOff("2026-12-25", saved(), picked);
    expect(pendingDaysOff(saved(), unpicked)).toEqual({
      added: [],
      removed: [],
    });
  });

  /**
   * The list under the edit can change while the card is open: the query refetches on
   * focus, and the staff app edits the same days. A day this admin picked that someone else
   * has since saved shows as off; one click must take it off, not do nothing.
   */
  it("takes off a day it picked that someone else has since saved", () => {
    const picked = toggleDayOff("2026-12-25", saved(), NO_EDIT);
    const nowSaved = saved("2026-12-25");
    expect(isOffInEdit("2026-12-25", nowSaved, picked)).toBe(true);

    const next = toggleDayOff("2026-12-25", nowSaved, picked);
    expect(isOffInEdit("2026-12-25", nowSaved, next)).toBe(false);
    expect(pendingDaysOff(nowSaved, next)).toEqual({
      added: [],
      removed: ["2026-12-25"],
    });
  });

  /** And the other way round: a day it reopened that someone else has since removed. */
  it("puts back a day it reopened that someone else has since removed", () => {
    const reopened = toggleDayOff("2026-12-25", saved("2026-12-25"), NO_EDIT);
    const nowGone = saved();
    expect(isOffInEdit("2026-12-25", nowGone, reopened)).toBe(false);

    const next = toggleDayOff("2026-12-25", nowGone, reopened);
    expect(isOffInEdit("2026-12-25", nowGone, next)).toBe(true);
    expect(pendingDaysOff(nowGone, next)).toEqual({
      added: ["2026-12-25"],
      removed: [],
    });
  });
});

describe("pendingDaysOff", () => {
  /**
   * What a save sends is the change against the list as it now stands, so a day another
   * admin has already made the same change to is not counted as one of this admin's.
   */
  it("leaves out changes the saved list already has", () => {
    expect(
      pendingDaysOff(
        saved("2026-12-25"),
        edit(["2026-12-25", "2026-12-26"], ["2027-01-01"]),
      ),
    ).toEqual({ added: ["2026-12-26"], removed: [] });
  });

  it("sends the days in calendar order", () => {
    expect(
      pendingDaysOff(saved(), edit(["2027-01-02", "2026-12-25", "2026-12-31"])),
    ).toEqual({
      added: ["2026-12-25", "2026-12-31", "2027-01-02"],
      removed: [],
    });
  });
});

describe("formatDayOff", () => {
  /**
   * The day is a calendar day, not an instant, so it must read the same wherever the
   * browser is. Built with `new Date("2026-12-25")` and formatted in the browser's zone,
   * an admin west of UTC would see Christmas Eve.
   */
  it("names the day it was given", () => {
    const text = formatDayOff("2026-12-25", "en");
    expect(text).toMatch(/Fri/);
    expect(text).toMatch(/25/);
    expect(text).toMatch(/Dec/);
  });

  it("names it in Chinese", () => {
    expect(formatDayOff("2026-12-25", "zh")).toMatch(/12月25日/);
  });
});
