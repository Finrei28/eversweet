import type { Status } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("~/server/auth", () => ({ auth: vi.fn() }));
// The save publishes a cache tag; there is no Next request scope in a test.
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));

import { revalidateTag } from "next/cache";

import { todayNZ } from "~/lib/aucklandDay";
import { addDaysToKey, atNZ, toDaysOffKeys } from "~/lib/pickUpTimes";
import { lockDaysOff } from "~/server/api/routers/settings";
import { db } from "~/server/db";
import { getDaysOff as checkoutDaysOff } from "~/server/pickUpTimes";
import { adminCaller } from "~/test/caller";
import { describeIfDb, resetDatabase } from "~/test/db";

/**
 * Days off, edited from /admin/settings as well as from the staff app's Settings.
 *
 * Both write the same `DaysOff` rows, and three readers match them by Auckland calendar
 * day: this site's checkout, the order server and the customer app. What these pin is that
 * a day written here is one those readers see as that day, and that an edit from here
 * changes only the days it names - the staff app's tablets edit the same list.
 */

/** A day relative to today on the Auckland calendar, which is what the router checks against. */
const day = (offset: number) => addDaysToKey(todayNZ(), offset);

const rowsOn = async () =>
  (await db.daysOff.findMany({ select: { date: true } })).map((r) => r.date);

const order = (
  pickUpTime: Date,
  status: Status = "ACCEPTED",
  customerFirstName = "Aroha",
) =>
  db.order.create({
    data: {
      tempOrderId: "test",
      priceInCents: 1250,
      GST: 163,
      customerFirstName,
      customerLastName: "Ngata",
      customerEmail: "aroha@example.test",
      customerPhoneNumber: "021 555 0100",
      status,
      pickUpTime,
    },
    select: { id: true },
  });

describeIfDb("days off", { timeout: 30_000 }, () => {
  beforeEach(async () => {
    await resetDatabase();
    vi.mocked(revalidateTag).mockClear();
  });

  describe("saveDaysOff", () => {
    /**
     * Auckland midnight is how the staff app stores a day off and what this site's checkout
     * reads from (`getDaysOffCached` bounds on it). Midnight UTC on the same date is 12-13
     * hours later, and the server runs in UTC.
     */
    it("stores a picked day as Auckland midnight, which the checkout reads as that day", async () => {
      const answer = await adminCaller().settings.saveDaysOff({
        added: [day(10)],
        removed: [],
      });

      expect(answer).toEqual([day(10)]);
      expect(await rowsOn()).toEqual([atNZ(day(10), 0)]);
      expect(toDaysOffKeys(await checkoutDaysOff())).toEqual(
        new Set([day(10)]),
      );
    });

    /** Otherwise the website's own checkout offers the day for up to five minutes. */
    it("clears this site's cached days off", async () => {
      await adminCaller().settings.saveDaysOff({
        added: [day(10)],
        removed: [],
      });

      expect(revalidateTag).toHaveBeenCalledWith("days-off");
    });

    it("takes today", async () => {
      await adminCaller().settings.saveDaysOff({
        added: [day(0)],
        removed: [],
      });

      expect(await rowsOn()).toEqual([atNZ(day(0), 0)]);
    });

    it("refuses a day that has already passed, and writes nothing", async () => {
      await expect(
        adminCaller().settings.saveDaysOff({
          added: [day(10), day(-1)],
          removed: [],
        }),
      ).rejects.toThrow(/already passed/i);

      expect(await rowsOn()).toEqual([]);
      expect(revalidateTag).not.toHaveBeenCalled();
    });

    it("refuses a day it is asked both to add and to remove", async () => {
      await expect(
        adminCaller().settings.saveDaysOff({
          added: [day(10)],
          removed: [day(10)],
        }),
      ).rejects.toThrow();
    });

    /**
     * Matched by day, as the order server matches them: a row the staff app wrote at
     * another instant of the same Auckland day is already that day off.
     */
    it("writes no second row for a day already off, however that row was stored", async () => {
      await db.daysOff.create({ data: { date: atNZ(day(10), 9 * 60) } });

      await adminCaller().settings.saveDaysOff({
        added: [day(10)],
        removed: [],
      });

      expect(await db.daysOff.count()).toBe(1);
    });

    it("removes every row on a day it reopens, however each was stored", async () => {
      await db.daysOff.createMany({
        data: [
          { date: atNZ(day(10), 0) },
          { date: atNZ(day(10), 9 * 60) },
          { date: atNZ(day(11), 0) },
        ],
      });

      const answer = await adminCaller().settings.saveDaysOff({
        added: [],
        removed: [day(10)],
      });

      expect(answer).toEqual([day(11)]);
      expect(await rowsOn()).toEqual([atNZ(day(11), 0)]);
    });

    /**
     * A save sends the change, not the list. The staff app's tablets edit the same days, and
     * the tablets' own save used to send the whole list, which deleted a day another tablet
     * had added since the calendar was opened.
     */
    it("leaves alone the days it was not asked to change", async () => {
      await db.daysOff.create({ data: { date: atNZ(day(12), 0) } });

      await adminCaller().settings.saveDaysOff({
        added: [day(10)],
        removed: [],
      });

      expect(
        (await rowsOn()).map((d) => d.getTime()).sort((a, b) => a - b),
      ).toEqual([atNZ(day(10), 0).getTime(), atNZ(day(12), 0).getTime()]);
    });

    /** Past days off are history; nothing on this screen shows them, so nothing removes them. */
    it("keeps past days off through a save", async () => {
      await db.daysOff.create({ data: { date: atNZ(day(-3), 0) } });

      await adminCaller().settings.saveDaysOff({
        added: [day(10)],
        removed: [],
      });

      expect(await db.daysOff.count()).toBe(2);
    });

    /**
     * Two admins adding the same day together. The read and the insert are separate
     * moments, so without taking turns both see no row and both insert one.
     *
     * Deterministic, as the announcements' version is: another save is held open with its
     * row written but not committed while this one runs. Taking turns, this save waits, then
     * sees the row and writes nothing. Without the lock it cannot see an uncommitted row and
     * writes a second.
     */
    it("makes a save wait for one in progress, so a day is written once", async () => {
      let release!: () => void;
      const held = new Promise<void>((resolve) => (release = resolve));
      let written!: () => void;
      const rowWritten = new Promise<void>((resolve) => (written = resolve));

      const otherAdmin = db.$transaction(
        async (tx) => {
          await lockDaysOff(tx);
          await tx.daysOff.create({ data: { date: atNZ(day(10), 0) } });
          written();
          await held;
        },
        { timeout: 20_000 },
      );
      await rowWritten;

      const save = adminCaller().settings.saveDaysOff({
        added: [day(10)],
        removed: [],
      });
      await Promise.race([
        save.catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 1_500)),
      ]);
      release();
      await otherAdmin;
      await save;

      expect(await db.daysOff.count()).toBe(1);
    });
  });

  describe("getDaysOff", () => {
    it("lists today onwards, each day once, in order", async () => {
      await db.daysOff.createMany({
        data: [
          { date: atNZ(day(-3), 0) },
          { date: atNZ(day(5), 0) },
          { date: atNZ(day(0), 0) },
          { date: atNZ(day(5), 9 * 60) },
          { date: atNZ(day(2), 0) },
        ],
      });

      await expect(adminCaller().settings.getDaysOff()).resolves.toEqual([
        day(0),
        day(2),
        day(5),
      ]);
    });
  });

  describe("getOrdersBookedOn", () => {
    /**
     * By the Auckland calendar. Half past midnight on the day is the day before in UTC, and
     * ten to midnight the day before is the day before in both - a UTC day would take the
     * first out and put an order from the next day in.
     */
    it("finds the orders picked up on a day, by the Auckland calendar", async () => {
      const early = await order(atNZ(day(10), 30));
      const late = await order(atNZ(day(10), 23 * 60 + 50));
      await order(atNZ(day(9), 23 * 60 + 50));
      await order(atNZ(day(11), 10));

      const booked = await adminCaller().settings.getOrdersBookedOn({
        days: [day(10)],
      });

      expect(booked.map((o) => o.id)).toEqual([early.id, late.id]);
      expect(booked[0]).toMatchObject({
        day: day(10),
        customerName: "Aroha Ngata",
        customerPhoneNumber: "021 555 0100",
        status: "ACCEPTED",
      });
    });

    /** Staff have nobody to contact about an order that is finished or called off. */
    it("leaves out orders already collected or cancelled", async () => {
      const pending = await order(atNZ(day(10), 12 * 60), "PENDING");
      const making = await order(atNZ(day(10), 13 * 60), "MAKING");
      const ready = await order(atNZ(day(10), 14 * 60), "READY");
      await order(atNZ(day(10), 15 * 60), "PICKED_UP");
      await order(atNZ(day(10), 16 * 60), "CANCELLED");

      const booked = await adminCaller().settings.getOrdersBookedOn({
        days: [day(10)],
      });

      expect(booked.map((o) => o.id)).toEqual([
        pending.id,
        making.id,
        ready.id,
      ]);
    });

    it("covers several days at once", async () => {
      const first = await order(atNZ(day(10), 12 * 60));
      await order(atNZ(day(11), 12 * 60));
      const third = await order(atNZ(day(12), 12 * 60));

      const booked = await adminCaller().settings.getOrdersBookedOn({
        days: [day(12), day(10)],
      });

      expect(booked.map((o) => [o.id, o.day])).toEqual([
        [first.id, day(10)],
        [third.id, day(12)],
      ]);
    });

    it("answers nothing for no days", async () => {
      await order(atNZ(day(10), 12 * 60));

      await expect(
        adminCaller().settings.getOrdersBookedOn({ days: [] }),
      ).resolves.toEqual([]);
    });
  });
});
