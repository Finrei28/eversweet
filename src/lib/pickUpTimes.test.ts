import { fromZonedTime } from "date-fns-tz";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import cases from "./pickUpTimeCases.json";
import {
  addDaysToKey,
  asapPickUpTime,
  earliestReadyAt,
  formatMinutes,
  formatNZ,
  isTooSoon,
  nextDayWithSlots,
  nzMinuteOfDay,
  nzDayKey,
  pickUpProblem,
  pickUpSlots,
  toDaysOffKeys,
  toWeeklyHours,
  tradingWindow,
  type TradingCalendar,
  type WeeklyHours,
} from "./pickUpTimes";
import { DEFAULT_PREP_TIMES, quoteMinutes } from "./prepTimes";

type CaseHours = (number[] | null)[];

const toHours = (hours: CaseHours): WeeklyHours =>
  hours.map((day) => (day ? { opensAt: day[0]!, closesAt: day[1]! } : null));

const calendarFor = (
  hours: CaseHours | undefined,
  daysOff: string[],
): TradingCalendar => ({
  hours: toHours(hours ?? cases.hours),
  daysOff: new Set(daysOff),
});

const SHOP: TradingCalendar = calendarFor(undefined, []);

/** An instant on the Auckland clock, e.g. nz("2026-03-05", "21:20"). */
const nz = (day: string, time: string) =>
  fromZonedTime(`${day}T${time}:00`, "Pacific/Auckland");

/** Monday 2 March 2026, in daylight saving. The shop trades 12:30-9:30 PM Mon-Thu. */
const MON = "2026-03-02";
const THU = "2026-03-05";
const FRI = "2026-03-06";

/**
 * The shared cases, run as a whole under several device timezones. Everything here is
 * meant to read the Auckland clock, so the answers must not move when the process's own
 * timezone does - which is how the website's picker went wrong in a browser, and how the
 * confirmation email went wrong on Vercel.
 */
describe.each([
  ["this machine's timezone", undefined, undefined],
  ["UTC, as Vercel and CI run", "UTC", 0],
  ["Los Angeles", "America/Los_Angeles", 480],
  ["Kolkata, a half-hour offset", "Asia/Kolkata", -330],
])("the shared pick-up time cases, in %s", (_, timezone, offsetMinutes) => {
  const original = process.env.TZ;

  beforeAll(() => {
    if (timezone) process.env.TZ = timezone;
  });
  afterAll(() => {
    process.env.TZ = original;
  });

  if (timezone) {
    // Proves the switch took, so a pass here is not just the machine's own timezone again.
    it("is really running in that timezone", () => {
      expect(new Date("2026-03-02T00:00:00Z").getTimezoneOffset()).toBe(
        offsetMinutes,
      );
    });
  }

  it.each(cases.asap)("ASAP: $name", (c) => {
    const asap = asapPickUpTime(
      new Date(c.now),
      c.quoteMinutes,
      calendarFor(c.hours as CaseHours | undefined, c.daysOff),
    );

    expect(asap?.toISOString() ?? null).toBe(
      c.expected ? new Date(c.expected).toISOString() : null,
    );
  });

  it.each(cases.validity)("validity: $name", (c) => {
    expect(
      pickUpProblem(
        new Date(c.at),
        calendarFor(c.hours as CaseHours | undefined, c.daysOff),
      ),
    ).toBe(c.reason);
  });
});

/**
 * Every minute a pick-up could happen, worked out the slow way: each day's hours, minute
 * by minute, straight from the table. ASAP must be the first of these at or after the
 * kitchen's earliest, and the picker's slots must be exactly the ones on a ten-minute
 * mark - whatever the time of day, for every minute of the week.
 */
const validMinutes = (fromDay: string, days: number) => {
  const all: { at: Date; day: string; minute: number }[] = [];
  for (let offset = 0; offset < days; offset++) {
    const day = addDaysToKey(fromDay, offset);
    const [y, m, d] = day.split("-").map(Number);
    const hours = cases.hours[new Date(Date.UTC(y!, m! - 1, d)).getUTCDay()]!;
    for (let minute = hours[0]!; minute <= hours[1]! - 10; minute++) {
      const hh = String(Math.floor(minute / 60)).padStart(2, "0");
      const mm = String(minute % 60).padStart(2, "0");
      all.push({ at: nz(day, `${hh}:${mm}`), day, minute });
    }
  }
  return all;
};

describe.each([
  ["an ordinary week", MON, 7, 1],
  ["the weekend daylight saving ends", "2026-04-03", 4, 5],
  ["the weekend daylight saving starts", "2026-09-25", 4, 5],
])("against every valid minute, over %s", (_, fromDay, days, everyMinutes) => {
  const valid = validMinutes(addDaysToKey(fromDay, -1), days + 3);
  const firstAtOrAfter = (instant: Date) =>
    valid.find((v) => v.at.getTime() >= instant.getTime())!.at;

  it("ASAP is always the first valid minute the kitchen can make", () => {
    const start = nz(fromDay, "00:00").getTime();
    const mismatches: string[] = [];

    for (
      let t = start;
      t < start + days * 24 * 60 * 60 * 1000;
      t += everyMinutes * 60 * 1000
    ) {
      const now = new Date(t);
      for (const quote of [10, 20]) {
        const got = asapPickUpTime(now, quote, SHOP);
        const expected = firstAtOrAfter(earliestReadyAt(now, quote));
        if (got?.getTime() !== expected.getTime()) {
          mismatches.push(
            `${formatNZ(now, "EEE d MMM HH:mm")} +${quote}: got ${
              got ? formatNZ(got, "EEE HH:mm") : "null"
            }, expected ${formatNZ(expected, "EEE HH:mm")}`,
          );
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("slots are exactly the valid ten-minute marks the kitchen can make", () => {
    const start = nz(fromDay, "00:00").getTime();

    for (
      let t = start;
      t < start + days * 24 * 60 * 60 * 1000;
      t += 29 * 60 * 1000
    ) {
      const now = new Date(t);
      const earliest = earliestReadyAt(now, 10).getTime();
      for (const day of [nzDayKey(now), addDaysToKey(nzDayKey(now), 1)]) {
        const expected = valid
          .filter(
            (v) =>
              v.day === day &&
              v.minute % 10 === 0 &&
              v.at.getTime() >= earliest,
          )
          .map((v) => v.at.toISOString());

        expect(
          pickUpSlots(day, now, 10, SHOP).map((s) => s.toISOString()),
        ).toEqual(expected);
      }
    }
  });
});

describe("pickUpProblem at the edges of a day", () => {
  it.each([
    [MON, "12:29", "before-open"],
    [MON, "12:30", null],
    [MON, "14:10", null],
    [MON, "21:20", null],
    [MON, "21:21", "after-last-pick-up"],
    [MON, "21:30", "after-last-pick-up"],
    [FRI, "11:59", "before-open"],
    [FRI, "12:00", null],
    [FRI, "21:50", null],
    [FRI, "21:51", "after-last-pick-up"],
  ])("%s %s is %s", (day, time, problem) => {
    expect(pickUpProblem(nz(day, time), SHOP)).toBe(problem);
  });

  it("calls an unusable date what it is, rather than throwing", () => {
    expect(pickUpProblem(new Date("not a date"), SHOP)).toBe("invalid-date");
  });
});

describe("isTooSoon", () => {
  const now = nz(MON, "14:00");
  const inMinutes = (n: number) => new Date(now.getTime() + n * 60_000);
  const tooSoon = (minutesAway: number, items: number) =>
    isTooSoon(
      inMinutes(minutesAway),
      now,
      quoteMinutes(items, DEFAULT_PREP_TIMES),
    );

  it("holds a small order to the ten minute quote", () => {
    expect(tooSoon(9, 2)).toBe(true);
    expect(tooSoon(10, 2)).toBe(false);
  });

  /**
   * A time chosen when the cart held two desserts is ten minutes out; a fourth pushes the
   * quote to fifteen, and the same time is now sooner than the kitchen can manage.
   */
  it("rejects a time that only suited a smaller order", () => {
    expect(tooSoon(10, 2)).toBe(false);
    expect(tooSoon(10, 4)).toBe(true);
    expect(tooSoon(15, 5)).toBe(false);
    expect(tooSoon(19, 8)).toBe(true);
    expect(tooSoon(20, 8)).toBe(false);
  });

  it("keeps the customer-facing floor for one item", () => {
    expect(tooSoon(9, 1)).toBe(true);
    expect(tooSoon(10, 1)).toBe(false);
  });

  it("treats a time in the past, or an unusable date, as too soon", () => {
    expect(tooSoon(-30, 2)).toBe(true);
    expect(isTooSoon(new Date("not a date"), now, 10)).toBe(true);
  });

  // The server's check allows for the seconds between the picker and the click.
  it("allows a grace period when asked", () => {
    expect(isTooSoon(inMinutes(7), now, 10, 5)).toBe(false);
    expect(isTooSoon(inMinutes(4), now, 10, 5)).toBe(true);
  });

  it("accepts every slot and every ASAP it hands out, for any order size", () => {
    for (const items of [1, 3, 5, 9]) {
      const quote = quoteMinutes(items, DEFAULT_PREP_TIMES);
      const slots = pickUpSlots(MON, now, quote, SHOP);
      const asap = asapPickUpTime(now, quote, SHOP)!;

      expect(slots.length).toBeGreaterThan(0);
      for (const time of [...slots, asap]) {
        expect(isTooSoon(time, now, quote)).toBe(false);
        expect(pickUpProblem(time, SHOP)).toBeNull();
      }
    }
  });
});

describe("pickUpSlots", () => {
  it("starts from the next ten-minute mark the kitchen can make", () => {
    expect(pickUpSlots(MON, nz(MON, "14:00"), 10, SHOP)[0]).toEqual(
      nz(MON, "14:10"),
    );
    expect(pickUpSlots(MON, nz(MON, "14:00"), 20, SHOP)[0]).toEqual(
      nz(MON, "14:20"),
    );
  });

  it("runs from opening to the last pick-up on a future day", () => {
    const slots = pickUpSlots(FRI, nz(MON, "14:00"), 10, SHOP);
    expect(slots[0]).toEqual(nz(FRI, "12:00"));
    expect(slots[slots.length - 1]).toEqual(nz(FRI, "21:50"));
  });

  it("offers nothing once today's last pick-up has gone, or on a day off", () => {
    expect(pickUpSlots(THU, nz(THU, "21:15"), 10, SHOP)).toEqual([]);
    expect(
      pickUpSlots(FRI, nz(MON, "14:00"), 10, calendarFor(undefined, [FRI])),
    ).toEqual([]);
  });
});

describe("nextDayWithSlots", () => {
  /**
   * The calendar used to hand back today's opening time - hours in the past - when a
   * customer picked today after its last slot. The next opening is what they need.
   */
  it("moves past a today with nothing left, to the next day with a slot", () => {
    expect(nextDayWithSlots(THU, nz(THU, "21:15"), 10, SHOP)).toBe(FRI);
    expect(nextDayWithSlots(THU, nz(THU, "21:05"), 10, SHOP)).toBe(THU);
  });

  it("skips days off", () => {
    expect(
      nextDayWithSlots(
        THU,
        nz(THU, "21:15"),
        10,
        calendarFor(undefined, [FRI, "2026-03-07"]),
      ),
    ).toBe("2026-03-08");
  });

  it("is null when nothing opens in the next 60 days", () => {
    expect(
      nextDayWithSlots(
        MON,
        nz(MON, "14:00"),
        10,
        calendarFor(Array(7).fill(null), []),
      ),
    ).toBeNull();
  });
});

describe("tradingWindow", () => {
  it("gives the day's opening, closing and last pick-up as instants", () => {
    expect(tradingWindow(THU, SHOP)).toEqual({
      opensAt: nz(THU, "12:30"),
      closesAt: nz(THU, "21:30"),
      lastPickUp: nz(THU, "21:20"),
    });
  });
});

describe("reading the database", () => {
  it("turns the table's rows into weekly hours, with a missing weekday closed", () => {
    expect(
      toWeeklyHours([
        { weekday: 1, opensAt: 750, closesAt: 1290 },
        { weekday: 3, opensAt: null, closesAt: null },
      ]),
    ).toEqual([
      null,
      { opensAt: 750, closesAt: 1290 },
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  /**
   * The admin app stores a day off as midnight on the chosen Auckland day - which is the
   * previous day in UTC. Keyed on UTC, every day off would close the wrong day.
   */
  it("keys days off by their Auckland calendar day", () => {
    expect([...toDaysOffKeys([nz(FRI, "00:00")])]).toEqual([FRI]);
  });
});

describe("reading the Auckland clock on a device in another zone", () => {
  const original = process.env.TZ;
  afterAll(() => {
    process.env.TZ = original;
  });

  /**
   * On 8 March 2026 Los Angeles skips 2:00-3:00 AM. `formatInTimeZone` resolves through a
   * device-local Date, so the Auckland time 2:30 AM that day read as 3:30 in a browser
   * there. The day and minute helpers read `Intl` directly instead.
   */
  it("reads an Auckland time that falls in the device's daylight saving gap", () => {
    process.env.TZ = "America/Los_Angeles";
    expect(new Date("2026-03-02T00:00:00Z").getTimezoneOffset()).toBe(480);

    const aucklandHalfTwo = new Date("2026-03-08T02:30:00+13:00");
    expect(nzMinuteOfDay(aucklandHalfTwo)).toBe(150);
    expect(nzDayKey(aucklandHalfTwo)).toBe("2026-03-08");
  });

  it("reads midnight as the start of the day, not 24:00", () => {
    expect(nzMinuteOfDay(nz("2026-03-09", "00:05"))).toBe(5);
  });
});

describe("formatting", () => {
  it.each([
    [720, "12:00 PM"],
    [750, "12:30 PM"],
    [1290, "9:30 PM"],
    [0, "12:00 AM"],
    [1439, "11:59 PM"],
  ])("%i minutes is %s", (minutes, label) => {
    expect(formatMinutes(minutes)).toBe(label);
  });

  it("formats on the Auckland clock", () => {
    expect(formatNZ(nz(THU, "20:29"), "h:mm a")).toBe("8:29 PM");
  });
});
