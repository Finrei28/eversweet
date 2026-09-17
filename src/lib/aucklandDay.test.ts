import { DateTime, Settings } from "luxon";
import { describe, expect, it } from "vitest";

import {
  calendarDate,
  endOfDayNZ,
  pickedDay,
  startOfDayNZ,
} from "./aucklandDay";

/**
 * Runs `fn` as if the process were in `zone`. luxon's default zone is what `fromJSDate`
 * reads a `Date` in, so this is how a test plays the admin's browser, or Vercel.
 */
const inZone = <T>(zone: string, fn: () => T): T => {
  const previous = Settings.defaultZone;
  Settings.defaultZone = zone;
  try {
    return fn();
  } finally {
    Settings.defaultZone = previous;
  }
};

const inNZ = (date: Date) =>
  DateTime.fromJSDate(date).setZone("Pacific/Auckland").toISO();

/** What the calendar hands back for 31 October in an Auckland browser: midnight there. */
const CLICKED_31_OCTOBER_IN_NZ = new Date("2026-10-30T11:00:00.000Z");

describe("pickedDay", () => {
  it("reads the day the admin clicked, in the browser's zone", () => {
    expect(
      inZone("Pacific/Auckland", () => pickedDay(CLICKED_31_OCTOBER_IN_NZ)),
    ).toBe("2026-10-31");
  });

  /**
   * Why it has to run in the browser: the same instant read on a UTC host is the day
   * before. That is the reading the server used to do.
   */
  it("gives the day before when the same click is read in UTC", () => {
    expect(inZone("UTC", () => pickedDay(CLICKED_31_OCTOBER_IN_NZ))).toBe(
      "2026-10-30",
    );
  });

  it("gives an admin behind NZ the day they clicked, not Auckland's", () => {
    const clicked = inZone("America/Los_Angeles", () =>
      DateTime.fromObject({ year: 2026, month: 1, day: 3 }).toJSDate(),
    );

    expect(inZone("America/Los_Angeles", () => pickedDay(clicked))).toBe(
      "2026-01-03",
    );
  });
});

describe("calendarDate", () => {
  // An offer that starts on the 31st, as stored. In Los Angeles that instant is still
  // the 30th, so showing it raw would put the wrong day in the edit form.
  const STARTS_31_OCTOBER = new Date("2026-10-30T11:00:00.000Z");
  const ENDS_31_OCTOBER = new Date("2026-10-31T10:59:59.999Z");

  it.each(["Pacific/Auckland", "UTC", "America/Los_Angeles"])(
    "shows a stored date as its Auckland day in %s",
    (zone) => {
      for (const stored of [STARTS_31_OCTOBER, ENDS_31_OCTOBER]) {
        expect(inZone(zone, () => pickedDay(calendarDate(stored)))).toBe(
          "2026-10-31",
        );
      }
    },
  );

  // The edit form's round trip: stored, shown, saved again, unchanged.
  it("round-trips through the day it shows", () => {
    inZone("America/Los_Angeles", () => {
      expect(startOfDayNZ(pickedDay(calendarDate(STARTS_31_OCTOBER)))).toEqual(
        STARTS_31_OCTOBER,
      );
      expect(endOfDayNZ(pickedDay(calendarDate(ENDS_31_OCTOBER)))).toEqual(
        ENDS_31_OCTOBER,
      );
    });
  });
});

describe("startOfDayNZ", () => {
  it("is midnight at the start of the day in Auckland", () => {
    expect(inNZ(startOfDayNZ("2026-10-31"))).toBe(
      "2026-10-31T00:00:00.000+13:00",
    );
  });
});

describe("endOfDayNZ", () => {
  it("is the last instant of the day in Auckland", () => {
    expect(inNZ(endOfDayNZ("2026-10-15"))).toBe(
      "2026-10-15T23:59:59.999+13:00",
    );
  });

  /**
   * The test that fails if the day is ever read off a `Date` on the server again. On
   * Vercel that made every chosen date a day early.
   */
  it("gives the same instant whatever zone the host runs in", () => {
    for (const zone of ["UTC", "Pacific/Auckland", "America/Los_Angeles"]) {
      expect(inZone(zone, () => endOfDayNZ("2026-10-31").toISOString())).toBe(
        "2026-10-31T10:59:59.999Z",
      );
      expect(inZone(zone, () => startOfDayNZ("2026-10-31").toISOString())).toBe(
        "2026-10-30T11:00:00.000Z",
      );
    }
  });

  it("uses the offset in force on that day", () => {
    expect(inNZ(endOfDayNZ("2026-06-30"))).toBe(
      "2026-06-30T23:59:59.999+12:00",
    );
  });

  // 27 September 2026 is 23 hours long in Auckland: clocks jump from 2am to 3am.
  it("spans the whole of a daylight-saving day", () => {
    expect(inNZ(startOfDayNZ("2026-09-27"))).toBe(
      "2026-09-27T00:00:00.000+12:00",
    );
    expect(inNZ(endOfDayNZ("2026-09-27"))).toBe(
      "2026-09-27T23:59:59.999+13:00",
    );
  });
});
