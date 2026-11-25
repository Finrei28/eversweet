import { describe, expect, it } from "vitest";

import {
  announcementSchema,
  announcementsFormSchema,
  createOfferSchema,
  editSchema,
  LOYALTY_POINTS_PRICE_MAX,
  membershipBenefitsFormSchema,
  membershipBenefitsSchema,
  offerFormSchema,
  offerRequirementSchema,
  priceInLoyaltyPointsSchema,
  saveAnnouncementsSchema,
  updateOfferSchema,
  updateProductSchema,
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
   *
   * `innerType()` because each row is refined, so that an end date before the
   * announcement's own is refused.
   */
  it("shares every field but the dates", () => {
    const formRow =
      announcementsFormSchema.shape.announcements.element.innerType().shape;
    const wireRow = announcementSchema.innerType().shape;

    expect(Object.keys(formRow).sort()).toEqual([
      "endsAt",
      "id",
      "isActive",
      "publishedAt",
      "text1",
      "text2",
      "title",
    ]);
    expect(Object.keys(wireRow).sort()).toEqual([
      "endsOn",
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

  /**
   * An end before the announcement's own date would never show, and saving it would say
   * nothing (the app's TODO item 8, entry 1). The same day is fine: it shows for that day.
   *
   * The form compares days, not instants. A new row's date is the moment it was added, so
   * an end picked for that same day is an earlier instant.
   */
  it("refuses an end before the announcement's date, on both", () => {
    const afternoon = new Date(2026, 9, 31, 15, 30);
    const formWith = (endsAt: Date) =>
      announcementsFormSchema.safeParse({
        announcements: [{ ...row, publishedAt: afternoon, endsAt }],
      });
    const wireWith = (endsOn: string) =>
      announcementSchema.safeParse({ ...row, publishedOn: day, endsOn });

    expect(formWith(new Date(2026, 9, 30)).success).toBe(false);
    expect(formWith(new Date(2026, 9, 31)).success).toBe(true);
    expect(wireWith("2026-10-30").success).toBe(false);
    expect(wireWith(day).success).toBe(true);
    // And none at all, which is accepted and left absent: the save then keeps the stored
    // end, so a tab from before end dates cannot clear one.
    const none = announcementSchema.safeParse({ ...row, publishedOn: day });
    expect(none.success).toBe(true);
    expect(none.data).not.toHaveProperty("endsOn");
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

describe("a dessert's price in points", () => {
  it("is the same schema on the edit form and the mutation", () => {
    expect(editSchema.shape.priceInLoyaltyPoints).toBe(
      priceInLoyaltyPointsSchema,
    );
    expect(updateProductSchema.shape.priceInLoyaltyPoints).toBe(
      priceInLoyaltyPointsSchema,
    );
  });

  it("reads the form's text as a whole number", () => {
    expect(priceInLoyaltyPointsSchema.parse("750")).toBe(750);
  });

  /** The order server refuses a redemption whose points differ, so 0 is unredeemable. */
  it.each([0, -1, 1.5, LOYALTY_POINTS_PRICE_MAX + 1, ""])(
    "refuses %j",
    (value) => {
      expect(priceInLoyaltyPointsSchema.safeParse(value).success).toBe(false);
    },
  );

  it("accepts 1 and the ceiling", () => {
    expect(priceInLoyaltyPointsSchema.safeParse(1).success).toBe(true);
    expect(
      priceInLoyaltyPointsSchema.safeParse(LOYALTY_POINTS_PRICE_MAX).success,
    ).toBe(true);
  });
});

/**
 * What unlocks an offer: so many of a dessert, so many from a category, or a minimum spend
 * on the order. The order server checks a row by whichever of the three it names, so a row
 * naming two of them would be read as only one, and a row naming none never unlocks.
 */
describe("offer requirement schemas", () => {
  const dessertRow = { dessertId: "dessert-1", quantity: 2 };
  const spendRow = { minSpendInCents: 2000, quantity: 1 };

  it("takes a minimum spend that names no dessert or category", () => {
    expect(offerRequirementSchema.parse(spendRow)).toEqual({
      dessertId: null,
      categoryId: null,
      minSpendInCents: 2000,
      quantity: 1,
    });
  });

  it("leaves the spend empty on a dessert or category row", () => {
    expect(offerRequirementSchema.parse(dessertRow).minSpendInCents).toBeNull();
  });

  it.each([
    ["a dessert and a spend", { ...spendRow, dessertId: "dessert-1" }],
    ["a category and a spend", { ...spendRow, categoryId: "category-1" }],
    ["a dessert and a category", { ...dessertRow, categoryId: "category-1" }],
    ["nothing at all", { quantity: 1 }],
  ])("refuses a row naming %s", (_, row) => {
    expect(offerRequirementSchema.safeParse(row).success).toBe(false);
  });

  it.each([0, -100, 19.5])("refuses a spend of %j cents", (minSpendInCents) => {
    expect(
      offerRequirementSchema.safeParse({ ...spendRow, minSpendInCents })
        .success,
    ).toBe(false);
  });

  /**
   * Two amounts on one offer would only ever mean the larger of them, so the smaller is a
   * mistake. Checked on the form and on both mutations, which share one requirements
   * schema - the same object, so a rule added to one cannot miss the others.
   */
  it("refuses a second minimum spend on one offer, on the form and the wire", () => {
    const formShape = offerFormSchema.innerType().shape;
    expect(createOfferSchema.innerType().shape.requirements).toBe(
      formShape.requirements,
    );
    expect(updateOfferSchema.innerType().shape.requirements).toBe(
      formShape.requirements,
    );

    expect(
      formShape.requirements.safeParse([spendRow, dessertRow]).success,
    ).toBe(true);
    expect(
      formShape.requirements.safeParse([
        spendRow,
        { ...spendRow, minSpendInCents: 3000 },
      ]).success,
    ).toBe(false);
  });
});


/**
 * A combo: one price for 2-4 slots, each a dessert or a whole category, and no dessert,
 * category or exclusions of its own - the database's CHECKs hold the same
 * (20261125000000_offer_combos), and the router holds the price ceiling.
 */
describe("combo offer schemas", () => {
  const base = { name: "Mochi + Sago", audience: "EVERYONE" as const };
  const slots = [{ categoryId: "mochi" }, { categoryId: "sago" }];
  const ok = (offer: object) => createOfferSchema.safeParse(offer).success;

  it("takes one price for two to four slots", () => {
    const parsed = createOfferSchema.parse({
      ...base,
      comboPriceInCents: 1500,
      comboSlots: slots,
    });
    expect(parsed.comboPriceInCents).toBe(1500);
    expect(parsed.comboSlots).toEqual([
      { dessertId: null, categoryId: "mochi" },
      { dessertId: null, categoryId: "sago" },
    ]);
    expect(
      ok({ ...base, comboPriceInCents: 0, comboSlots: [...slots, ...slots] }),
    ).toBe(true);
  });

  it.each([
    ["one slot", [{ categoryId: "mochi" }]],
    ["five slots", [...slots, ...slots, { categoryId: "mochi" }]],
  ])("refuses a combo of %s", (_, comboSlots) => {
    expect(ok({ ...base, comboPriceInCents: 1500, comboSlots })).toBe(false);
  });

  it.each([
    ["a category of its own", { categoryId: "sago" }],
    ["a dessert of its own", { dessertId: "taro" }],
    ["a fixed price too", { itemPriceInCents: 500 }],
    ["a percentage too", { discountAmount: 20 }],
  ])("refuses a combo with %s", (_, extra) => {
    expect(
      ok({ ...base, comboPriceInCents: 1500, comboSlots: slots, ...extra }),
    ).toBe(false);
  });

  it("refuses slots on an offer that is not a combo", () => {
    expect(
      ok({ ...base, categoryId: "sago", discountAmount: 20, comboSlots: slots }),
    ).toBe(false);
  });

  it.each([
    ["nothing", {}],
    ["a dessert and a category", { dessertId: "taro", categoryId: "mochi" }],
  ])("refuses a slot naming %s", (_, slot) => {
    expect(
      ok({ ...base, comboPriceInCents: 1500, comboSlots: [slot, slots[1]] }),
    ).toBe(false);
  });

  // "Any sago but the durian". Absent rather than empty when a part is sent without the
  // list - a tab opened before parts could leave desserts out - so the router can keep what
  // is stored instead of clearing it.
  it("keeps what a part leaves out, and tells a part sent without the list apart", () => {
    const parsed = createOfferSchema.parse({
      ...base,
      comboPriceInCents: 1500,
      comboSlots: [slots[0], { ...slots[1], excludedDessertIds: ["durian"] }],
    });
    expect(parsed.comboSlots[1]?.excludedDessertIds).toEqual(["durian"]);
    expect(parsed.comboSlots[0]?.excludedDessertIds).toBeUndefined();
    expect(
      ok({
        ...base,
        comboPriceInCents: 1500,
        comboSlots: [slots[0], { ...slots[1], excludedDessertIds: [""] }],
      }),
    ).toBe(false);
  });

  it("refuses a negative combo price", () => {
    expect(ok({ ...base, comboPriceInCents: -1, comboSlots: slots })).toBe(false);
  });

  // One object for the form and both mutations, so the dialog refuses what the router would.
  it("shares the slots and the price between the form and both mutations", () => {
    const formShape = offerFormSchema.innerType().shape;
    expect(formShape.comboSlots).toBeDefined();
    expect(formShape.comboPriceInCents).toBeDefined();
    for (const schema of [createOfferSchema, updateOfferSchema]) {
      expect(schema.innerType().shape.comboSlots).toBe(formShape.comboSlots);
      expect(schema.innerType().shape.comboPriceInCents).toBe(
        formShape.comboPriceInCents,
      );
    }
  });
});
