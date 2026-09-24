import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("~/server/auth", () => ({ auth: vi.fn() }));
// The shop-profile save publishes a cache tag; there is no Next request scope in a test.
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));

import { db } from "~/server/db";
import { adminCaller } from "~/test/caller";
import { describeIfDb, resetDatabase } from "~/test/db";

/**
 * The settings that moved out of the order server's code and into the database.
 *
 * What these pin is the behaviour that is invisible from the screen and would regress in
 * silence: that a singleton is created rather than quietly skipped on an unseeded table,
 * that an announcement keeps its date through an edit, and that saving the list does not
 * take rows with it that the admin did not remove.
 */
describeIfDb("settings router", { timeout: 30_000 }, () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe("loyalty rates", () => {
    /**
     * `updateMany` matches nothing on an unseeded table and reports success, so without the
     * create branch a save would look like it worked and change nothing.
     */
    it("creates the row when the table has never been seeded", async () => {
      await adminCaller().settings.saveLoyaltyRates({
        pointsPerDollar: 8,
        memberBonusPercent: 200,
        modifierPercent: 100,
      });

      const rows = await db.loyaltySetting.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        pointsPerDollar: 8,
        memberBonusPercent: 200,
      });
    });

    it("updates in place rather than adding a second row", async () => {
      const caller = adminCaller();
      await caller.settings.saveLoyaltyRates({
        pointsPerDollar: 6,
        memberBonusPercent: 150,
        modifierPercent: 100,
      });
      await caller.settings.saveLoyaltyRates({
        pointsPerDollar: 7,
        memberBonusPercent: 150,
        modifierPercent: 200,
      });

      const rows = await db.loyaltySetting.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        pointsPerDollar: 7,
        modifierPercent: 200,
      });
    });

    /** The rates the order server falls back to, so an empty table edits from the truth. */
    it("reads back the hardcoded rates when nothing is stored", async () => {
      await expect(adminCaller().settings.getLoyaltyRates()).resolves.toEqual({
        pointsPerDollar: 6,
        memberBonusPercent: 150,
        modifierPercent: 100,
      });
    });

    it("refuses a member bonus that would earn members less than everyone else", async () => {
      await expect(
        adminCaller().settings.saveLoyaltyRates({
          pointsPerDollar: 6,
          memberBonusPercent: 50,
          modifierPercent: 100,
        }),
      ).rejects.toThrow();
    });
  });

  /**
   * The switch's moment is every customer's launch grace on the order server, so the thing
   * that must not happen by accident is that moment moving.
   */
  describe("points expiry", () => {
    const seed = () => db.loyaltySetting.create({ data: { id: "default" } });
    const expireFrom = async () =>
      (await db.loyaltySetting.findFirstOrThrow()).pointsExpireFrom;

    it("is off until switched on", async () => {
      await seed();

      await expect(adminCaller().settings.getPointsExpiry()).resolves.toEqual({
        expireFrom: null,
      });
    });

    it("stamps the moment it is switched on", async () => {
      await seed();
      const before = Date.now();

      const result = await adminCaller().settings.setPointsExpiry({
        enabled: true,
      });

      const stamped = await expireFrom();
      expect(stamped).not.toBeNull();
      expect(stamped!.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.expireFrom).toEqual(stamped);
    });

    /** Otherwise a second click would quietly give every customer a fresh month. */
    it("keeps the original moment when switched on again", async () => {
      await seed();
      const caller = adminCaller();
      await caller.settings.setPointsExpiry({ enabled: true });
      const first = await expireFrom();

      await new Promise((resolve) => setTimeout(resolve, 20));
      await caller.settings.setPointsExpiry({ enabled: true });

      expect(await expireFrom()).toEqual(first);
    });

    it("clears it when switched off, and restarts it when switched back on", async () => {
      await seed();
      const caller = adminCaller();
      await caller.settings.setPointsExpiry({ enabled: true });
      const first = await expireFrom();

      await caller.settings.setPointsExpiry({ enabled: false });
      expect(await expireFrom()).toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 20));
      await caller.settings.setPointsExpiry({ enabled: true });
      expect((await expireFrom())!.getTime()).toBeGreaterThan(first!.getTime());
    });

    it("creates the row when the table has never been seeded", async () => {
      await adminCaller().settings.setPointsExpiry({ enabled: true });

      const rows = await db.loyaltySetting.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.pointsExpireFrom).not.toBeNull();
    });

    /** The benefits card shows whether a {{whilePointsExpire}} line is live. */
    it("tells the benefits card whether expiry is on", async () => {
      await seed();
      const caller = adminCaller();

      expect((await caller.settings.getSettingsWarnings({})).pointsExpire).toBe(
        false,
      );
      await caller.settings.setPointsExpiry({ enabled: true });
      expect((await caller.settings.getSettingsWarnings({})).pointsExpire).toBe(
        true,
      );
    });
  });

  describe("membership benefits", () => {
    const plan = () =>
      db.membershipPlan.create({
        data: {
          name: "Monthly_Membership",
          stripePriceId: `price_${Math.random().toString(36).slice(2)}`,
          benefits: ["Old benefit"],
        },
      });

    it("saves the list in the order it was given", async () => {
      await plan();

      await adminCaller().settings.saveMembershipBenefits({
        benefits: ["First", "Second", "Third"],
      });

      const saved = await db.membershipPlan.findFirst({
        select: { benefits: true },
      });
      expect(saved?.benefits).toEqual(["First", "Second", "Third"]);
    });

    /** A cleared field must remove the bullet, not leave an empty one on the join screen. */
    it("drops blank rows", async () => {
      await plan();

      await adminCaller().settings.saveMembershipBenefits({
        benefits: ["Kept", "   ", ""],
      });

      const saved = await db.membershipPlan.findFirst({
        select: { benefits: true },
      });
      expect(saved?.benefits).toEqual(["Kept"]);
    });

    it("refuses an empty list, which would advertise a membership offering nothing", async () => {
      await plan();

      await expect(
        adminCaller().settings.saveMembershipBenefits({ benefits: ["", "  "] }),
      ).rejects.toThrow();
    });

    /**
     * The wording is free text and cannot be constrained, so the screen checks it instead.
     * This is the drift that was actually live: "2x" against a 1.5x rate.
     */
    it("reports a benefit claiming a multiplier the rates do not give", async () => {
      await db.membershipPlan.create({
        data: {
          name: "Monthly_Membership",
          stripePriceId: "price_warn",
          benefits: ["Earn 2x loyalty points", "Cancel anytime"],
        },
      });
      await db.loyaltySetting.create({
        data: { id: "default", memberBonusPercent: 150 },
      });

      const warnings = await adminCaller().settings.getSettingsWarnings({});

      expect(warnings.memberMultiplier).toBe(1.5);
      expect(warnings.claimsOtherMultiplier).toEqual([
        "Earn 2x loyalty points",
      ]);
    });

    it("says nothing when the wording matches the rate", async () => {
      await db.membershipPlan.create({
        data: {
          name: "Monthly_Membership",
          stripePriceId: "price_ok",
          benefits: ["Earn 1.5x loyalty points"],
        },
      });
      await db.loyaltySetting.create({
        data: { id: "default", memberBonusPercent: 150 },
      });

      const warnings = await adminCaller().settings.getSettingsWarnings({});

      expect(warnings.claimsOtherMultiplier).toEqual([]);
    });
  });

  describe("announcements", () => {
    /**
     * The ids currently in the database. Saving replaces the whole list, so the mutation
     * takes the ids the form was opened with and refuses if they have changed since.
     */
    const currentIds = async () =>
      (await db.announcement.findMany({ select: { id: true } })).map(
        (a) => a.id,
      );

    const one = (overrides: Record<string, unknown> = {}) => ({
      title: "Closed Tuesday",
      text1: "We are shut for a private event.",
      isActive: true,
      publishedOn: "2026-07-01",
      ...overrides,
    });

    it("writes the picked day as an Auckland instant, not a UTC one", async () => {
      await adminCaller().settings.saveAnnouncements({
        knownIds: await currentIds(),
        announcements: [one()],
      });

      const saved = await db.announcement.findFirst();
      // Midnight on 1 July in Auckland is 30 June 12:00 UTC (NZST, UTC+12).
      expect(saved?.publishedAt.toISOString()).toBe("2026-06-30T12:00:00.000Z");
    });

    it("keeps positions in the order the list was given", async () => {
      await adminCaller().settings.saveAnnouncements({
        knownIds: await currentIds(),
        announcements: [
          one({ title: "First" }),
          one({ title: "Second" }),
          one({ title: "Third" }),
        ],
      });

      const saved = await db.announcement.findMany({
        orderBy: { position: "asc" },
        select: { title: true, position: true },
      });
      expect(saved).toEqual([
        { title: "First", position: 0 },
        { title: "Second", position: 1 },
        { title: "Third", position: 2 },
      ]);
    });

    /**
     * The load-bearing one. `publishedAt` is what the app compares against the last
     * announcement it showed, so rewriting it on every save would pop the modal for every
     * customer each time a typo was fixed.
     */
    it("leaves the date alone when only the text is edited", async () => {
      const caller = adminCaller();
      await caller.settings.saveAnnouncements({
        knownIds: await currentIds(),
        announcements: [one()],
      });
      const before = await db.announcement.findFirstOrThrow();

      await caller.settings.saveAnnouncements({
        knownIds: await currentIds(),
        announcements: [
          one({ id: before.id, text1: "We are shut for a private function." }),
        ],
      });

      const after = await db.announcement.findFirstOrThrow();
      expect(after.id).toBe(before.id);
      expect(after.text1).toBe("We are shut for a private function.");
      expect(after.publishedAt.toISOString()).toBe(
        before.publishedAt.toISOString(),
      );
    });

    it("moves the date when the admin moves it, which re-shows the pop-up", async () => {
      const caller = adminCaller();
      await caller.settings.saveAnnouncements({
        knownIds: await currentIds(),
        announcements: [one()],
      });
      const before = await db.announcement.findFirstOrThrow();

      await caller.settings.saveAnnouncements({
        knownIds: await currentIds(),
        announcements: [one({ id: before.id, publishedOn: "2026-08-15" })],
      });

      const after = await db.announcement.findFirstOrThrow();
      expect(after.publishedAt.getTime()).toBeGreaterThan(
        before.publishedAt.getTime(),
      );
    });

    it("removes only what was taken out of the list", async () => {
      const caller = adminCaller();
      await caller.settings.saveAnnouncements({
        knownIds: await currentIds(),
        announcements: [one({ title: "Keep" }), one({ title: "Drop" })],
      });
      const kept = await db.announcement.findFirstOrThrow({
        where: { title: "Keep" },
      });

      await caller.settings.saveAnnouncements({
        knownIds: await currentIds(),
        announcements: [one({ id: kept.id, title: "Keep" })],
      });

      const left = await db.announcement.findMany({ select: { title: true } });
      expect(left).toEqual([{ title: "Keep" }]);
    });

    it("refuses more showing at once than the pop-up should carry", async () => {
      await expect(
        adminCaller().settings.saveAnnouncements({
          knownIds: await currentIds(),
          announcements: Array.from({ length: 6 }, (_, i) =>
            one({ title: `Announcement ${i}` }),
          ),
        }),
      ).rejects.toThrow();
    });

    /**
     * Saving replaces the collection, so a form opened before somebody else added an
     * announcement used to delete it - silently, with nothing to say it had happened.
     */
    it("refuses a save built from a list that has since changed", async () => {
      const caller = adminCaller();
      await caller.settings.saveAnnouncements({
        knownIds: [],
        announcements: [one({ title: "First" })],
      });
      const stale = await currentIds();

      // Another admin, in another tab, adds one.
      await caller.settings.saveAnnouncements({
        knownIds: stale,
        announcements: [
          one({ id: stale[0], title: "First" }),
          one({ title: "Second" }),
        ],
      });

      await expect(
        caller.settings.saveAnnouncements({
          knownIds: stale,
          announcements: [one({ id: stale[0], title: "First, edited" })],
        }),
      ).rejects.toThrow(/changed the announcements/i);

      // And nothing was lost.
      const left = await db.announcement.findMany({ select: { title: true } });
      expect(left).toHaveLength(2);
    });

    it("refuses a save whose list was deleted from underneath it", async () => {
      const caller = adminCaller();
      await caller.settings.saveAnnouncements({
        knownIds: [],
        announcements: [one()],
      });
      const stale = await currentIds();

      await db.announcement.deleteMany({});

      await expect(
        caller.settings.saveAnnouncements({
          knownIds: stale,
          announcements: [one({ id: stale[0] })],
        }),
      ).rejects.toThrow(/changed the announcements/i);
    });

    /** A retired announcement is kept, so it can be brought back without retyping it. */
    it("counts only the ones showing towards that limit", async () => {
      await adminCaller().settings.saveAnnouncements({
        knownIds: await currentIds(),
        announcements: Array.from({ length: 6 }, (_, i) =>
          one({ title: `Announcement ${i}`, isActive: i < 5 }),
        ),
      });

      expect(await db.announcement.count()).toBe(6);
    });
  });
});
