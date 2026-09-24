import { describe, expect, it } from "vitest";

import {
  announcementSchema,
  announcementsFormSchema,
  membershipBenefitsFormSchema,
  membershipBenefitsSchema,
  saveAnnouncementsSchema,
} from "./schemas";
import {
  ANNOUNCEMENT_TEXT_MAX_LENGTH,
  ANNOUNCEMENT_TITLE_MAX_LENGTH,
  BENEFIT_MAX_LENGTH,
  MAX_ACTIVE_ANNOUNCEMENTS,
} from "~/lib/shopSettings";

/**
 * The settings forms and the mutations they submit to.
 *
 * Each pair is one set of fields in two shapes, because a calendar control holds a `Date`
 * and the wire carries the day the admin saw. They were written out twice to begin with -
 * the card declared its own copy - so a bound raised in one place would have been enforced
 * in one place, and the form would have accepted what the router then refused.
 */
describe("announcement schemas", () => {
  const day = "2026-10-31";
  const row = {
    title: "Now open",
    text1: "Come and see us.",
    isActive: true,
  };

  /**
   * The load-bearing assertion. Both schemas are built from one `announcementFields`, so
   * every field they share is the *same* schema object, not a copy that happens to agree
   * today. A field added to only one of them fails here.
   */
  it("shares every field but the date", () => {
    const formRow = announcementsFormSchema.shape.announcements.element.shape;
    const wireRow = announcementSchema.shape;

    expect(Object.keys(formRow).sort()).toEqual([
      "id",
      "isActive",
      "publishedAt",
      "text1",
      "text2",
      "title",
    ]);
    expect(Object.keys(wireRow).sort()).toEqual([
      "id",
      "isActive",
      "publishedOn",
      "text1",
      "text2",
      "title",
    ]);

    for (const field of [
      "id",
      "title",
      "text1",
      "text2",
      "isActive",
    ] as const) {
      expect(wireRow[field]).toBe(formRow[field]);
    }
  });

  it("holds the date as a Date on the form and as a day on the wire", () => {
    expect(
      announcementsFormSchema.safeParse({
        announcements: [{ ...row, publishedAt: new Date(day) }],
      }).success,
    ).toBe(true);
    expect(
      announcementSchema.safeParse({ ...row, publishedOn: day }).success,
    ).toBe(true);

    // Neither accepts the other's shape, so a card that forgot `pickedDay` would not
    // quietly send a serialised Date for the router to read a day out of.
    expect(
      announcementsFormSchema.safeParse({
        announcements: [{ ...row, publishedAt: day }],
      }).success,
    ).toBe(false);
    expect(
      announcementSchema.safeParse({ ...row, publishedOn: new Date(day) })
        .success,
    ).toBe(false);
  });

  /** A day, not an instant: "2026-10-31T00:00:00Z" is the bug this whole split avoids. */
  it("refuses a timestamp where it wants a day", () => {
    expect(
      announcementSchema.safeParse({ ...row, publishedOn: `${day}T00:00:00Z` })
        .success,
    ).toBe(false);
  });

  it("enforces the same bounds on both", () => {
    const cases = [
      ["title", ANNOUNCEMENT_TITLE_MAX_LENGTH],
      ["text1", ANNOUNCEMENT_TEXT_MAX_LENGTH],
      ["text2", ANNOUNCEMENT_TEXT_MAX_LENGTH],
    ] as const;

    for (const [field, max] of cases) {
      for (const [length, accepted] of [
        [max, true],
        [max + 1, false],
      ] as const) {
        const value = "a".repeat(length);
        expect(
          announcementSchema.safeParse({
            ...row,
            [field]: value,
            publishedOn: day,
          }).success,
          `wire ${field} at ${length}`,
        ).toBe(accepted);
        expect(
          announcementsFormSchema.safeParse({
            announcements: [
              { ...row, [field]: value, publishedAt: new Date(day) },
            ],
          }).success,
          `form ${field} at ${length}`,
        ).toBe(accepted);
      }
    }
  });

  /**
   * An id is what tells an update from an insert, so an empty string is worse than none -
   * it reads as a row that exists and matches nothing.
   */
  it("takes no id, but not a blank one", () => {
    expect(
      announcementSchema.safeParse({ ...row, publishedOn: day }).success,
    ).toBe(true);
    expect(
      announcementSchema.safeParse({ ...row, id: "", publishedOn: day })
        .success,
    ).toBe(false);
  });
});

describe("membership benefits schemas", () => {
  /**
   * Why these two cannot be one schema. The wire drops blank rows and then insists on at
   * least one, which is right for a saved list and wrong mid-edit: an admin who clears a
   * field to retype it would have the whole list rejected under them.
   */
  it("lets the form hold a blank row the wire would drop", () => {
    expect(
      membershipBenefitsFormSchema.safeParse({
        benefits: [
          { value: "Earn {{memberRate}}x loyalty points" },
          { value: "" },
        ],
      }).success,
    ).toBe(true);

    const saved = membershipBenefitsSchema.safeParse({
      benefits: ["Earn {{memberRate}}x loyalty points", ""],
    });
    expect(saved.success).toBe(true);
    expect(saved.data?.benefits).toEqual([
      "Earn {{memberRate}}x loyalty points",
    ]);
  });

  /** An empty list renders as a membership offering nothing. */
  it("refuses a list that is empty once the blanks are dropped", () => {
    expect(
      membershipBenefitsSchema.safeParse({ benefits: ["", "  "] }).success,
    ).toBe(false);
    expect(membershipBenefitsSchema.safeParse({ benefits: [] }).success).toBe(
      false,
    );
  });

  it("bounds a benefit the same way on both", () => {
    for (const [length, accepted] of [
      [BENEFIT_MAX_LENGTH, true],
      [BENEFIT_MAX_LENGTH + 1, false],
    ] as const) {
      const value = "a".repeat(length);
      expect(
        membershipBenefitsFormSchema.safeParse({ benefits: [{ value }] })
          .success,
        `form at ${length}`,
      ).toBe(accepted);
      expect(
        membershipBenefitsSchema.safeParse({ benefits: [value] }).success,
        `wire at ${length}`,
      ).toBe(accepted);
    }
  });

  /** The form is one object per row because `useFieldArray` keys rows on identity. */
  it("wraps each form row in an object and each wire row is bare", () => {
    expect(
      membershipBenefitsFormSchema.safeParse({ benefits: ["a string"] })
        .success,
    ).toBe(false);
    expect(
      membershipBenefitsSchema.safeParse({ benefits: [{ value: "an object" }] })
        .success,
    ).toBe(false);
  });
});

/**
 * The cap belongs to the mutation, not to a row, and it counts only the ones showing -
 * an archive of dismissed announcements is not what fills the app's pop-up.
 */
describe("the active announcement cap", () => {
  const showing = (count: number, total: number) =>
    Array.from({ length: total }, (_, i) => ({
      title: `Announcement ${i}`,
      text1: "Body",
      isActive: i < count,
      publishedOn: "2026-10-31",
    }));

  it("counts the showing ones only", () => {
    expect(
      saveAnnouncementsSchema.safeParse({
        knownIds: [],
        announcements: showing(
          MAX_ACTIVE_ANNOUNCEMENTS,
          MAX_ACTIVE_ANNOUNCEMENTS + 3,
        ),
      }).success,
    ).toBe(true);
    expect(
      saveAnnouncementsSchema.safeParse({
        knownIds: [],
        announcements: showing(
          MAX_ACTIVE_ANNOUNCEMENTS + 1,
          MAX_ACTIVE_ANNOUNCEMENTS + 1,
        ),
      }).success,
    ).toBe(false);
  });
});
