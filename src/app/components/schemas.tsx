import { z } from "zod";

import { pickedDay, todayNZ } from "~/lib/aucklandDay";
import { STAFF_STATUSES } from "~/lib/orderStatus";
import {
  COMBO_MAX_SLOTS,
  COMBO_MIN_SLOTS,
  DISCOUNT_MAX_PERCENT,
  DISCOUNT_MIN_PERCENT,
  hasExactlyOnePrice,
} from "~/lib/offerPricing";
import {
  ANNOUNCEMENT_TEXT_MAX_LENGTH,
  ANNOUNCEMENT_TITLE_MAX_LENGTH,
  BENEFIT_MAX_LENGTH,
  isAnnouncementShowing,
  MAX_ACTIVE_ANNOUNCEMENTS,
  MEMBER_BONUS_PERCENT_MAX,
  MEMBER_BONUS_PERCENT_MIN,
  MODIFIER_PERCENT_MAX,
  MODIFIER_PERCENT_MIN,
  POINTS_PER_DOLLAR_MAX,
  POINTS_PER_DOLLAR_MIN,
  SHOP_ABOUT_MAX_LENGTH,
} from "~/lib/shopSettings";

/** A generous ceiling: at the default 6 points a dollar this is over $16,000 of spend. */
export const LOYALTY_POINTS_PRICE_MAX = 100_000;

const fileSchema = z.instanceof(File, { message: "File is required" });
export const imageSchema = fileSchema.refine(
  (file) => file.size === 0 || file.type.startsWith("image/"),
);

export const ingredientSchema = z.object({
  name: z.string().min(1),
  id: z.string().min(1),
  priceInCents: z.coerce.number().int().optional(),
  chineseName: z.string().min(1),
  isAvailableForPurchase: z.boolean().optional(),
});

export const addSchema = z.object({
  name: z.string().min(1),
  chineseName: z.string().min(1),
  priceInCents: z.coerce.number().int(),
  description: z.string().optional(),
  ingredients: z.array(ingredientSchema).default([]),
  image: imageSchema.refine((file) => file.size > 0, "Image is Required"),
  categoryId: z.string().min(1),
});

export const createProductSchema = z.object({
  name: z.string().min(1),
  chineseName: z.string().min(1),
  priceInCents: z.coerce.number().int().min(1),
  description: z.string().optional(),
  ingredients: z.array(ingredientSchema).default([]),
  imagePath: z.string().min(1),
  imagePublicId: z.string().min(1),
  categoryId: z.string().min(1),
});

/**
 * What a dessert costs as an app reward. The order server treats a cart line with points
 * as a redemption and refuses one that does not send exactly this figure, so 0 would make
 * the dessert unredeemable rather than free. New desserts take the column's default (500).
 * Shared by the form and the mutation so the bound cannot drift between them.
 */
export const priceInLoyaltyPointsSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(LOYALTY_POINTS_PRICE_MAX);

export const editSchema = addSchema.extend({
  image: imageSchema.optional(),
  isAvailableForPurchase: z.boolean(),
  priceInLoyaltyPoints: priceInLoyaltyPointsSchema,
});

export const updateProductSchema = createProductSchema.extend({
  id: z.string().min(1),
  imagePath: z.string().optional(),
  imagePublicId: z.string().optional(),
  isAvailableForPurchase: z.boolean(),
  priceInLoyaltyPoints: priceInLoyaltyPointsSchema,
});

export const dessertSchema = z.object({
  id: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const customisationSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  chineseName: z.string(),
  quantity: z.number().int(),
});

export const orderSchema = z.object({
  priceInCents: z.coerce.number().int().min(1),
  dessert: dessertSchema,
  customisations: z.array(customisationSchema).default([]),
  discountedAmountInCents: z.coerce.number().int().optional(),
  promoId: z.string().nullable().optional(),
});

export const createOrderSchema = z.object({
  desserts: z.array(orderSchema).min(1),
  /**
   * The payment's client secret, not its id: the secret is what shows the caller is the
   * browser that paid. See `paymentIntentIdFromClientSecret` in ~/server/stripeCustomer.
   */
  clientSecret: z.string().min(1),
  customerFirstName: z.string().min(1),
  customerLastName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhoneNumber: z.string().min(1),
  totalPriceInCents: z.coerce.number().int().positive(),
  pickUpTime: z.date(),
});

/**
 * One requirement row on an offer: so many of a dessert, so many from a category, or a
 * minimum spend on the order.
 *
 * `id` is present for rows that already exist in the database and absent for rows the
 * admin just added. The update mutation uses that to patch rather than delete and
 * recreate, so requirement ids survive an unrelated edit.
 *
 * Exactly one of the three, which the database holds too
 * (`OfferRequirement_exactly_one_target`). The order server checks a row by whichever it
 * names first, so a dessert and a spend on one row would be a dessert requirement.
 * `quantity` means nothing on a spend row; the router stores 1 there.
 */
export const offerRequirementSchema = z
  .object({
    id: z.string().min(1).optional(),
    dessertId: z.string().min(1).nullable().default(null),
    categoryId: z.string().min(1).nullable().default(null),
    /** Cents, compared with what the card is charged for the order: `OfferRequirement` in schema.prisma. */
    minSpendInCents: z.coerce
      .number()
      .int()
      .positive()
      .nullable()
      .default(null),
    quantity: z.coerce.number().int().positive(),
  })
  .refine(
    (r) =>
      [r.dessertId, r.categoryId, r.minSpendInCents].filter((v) => v !== null)
        .length === 1,
    "Pick a dessert or a category, or set a minimum spend - one per row",
  );

/**
 * An offer's requirements. Every row must be met by one order, so two spends would only
 * ever mean the larger, and the smaller is a mistake.
 *
 * One schema object for the form and both mutations (`schemas.test.ts` checks they share
 * it), so the dialog refuses what the router would.
 */
const offerRequirementsSchema = z
  .array(offerRequirementSchema)
  .default([])
  .refine(
    (rows) => rows.filter((r) => r.minSpendInCents !== null).length <= 1,
    "An offer can have one minimum spend",
  );

/**
 * One part of a combo: one dessert, or a category to choose from less the desserts it leaves
 * out ("any sago but the durian"), as a category offer's `excludedDessertIds` does.
 *
 * The list is optional, not defaulted: a part sent without it - from a dialog opened before
 * parts could leave desserts out - keeps what is stored, where an empty list clears it. The
 * router resolves it, and stores none on a dessert part.
 */
export const offerComboSlotSchema = z
  .object({
    dessertId: z.string().min(1).nullable().default(null),
    categoryId: z.string().min(1).nullable().default(null),
    excludedDessertIds: z.array(z.string().min(1)).optional(),
  })
  .refine(
    (slot) => (slot.dessertId === null) !== (slot.categoryId === null),
    "Pick a dessert or a category for each part",
  );

/**
 * A combo's parts, in the order the app lists them. Empty on any other offer; the count is
 * checked with the rest of the offer below, since an empty list is right for a single offer.
 * The router replaces the rows on every save, so they carry no ids.
 */
const offerComboSlotsSchema = z
  .array(offerComboSlotSchema)
  .max(COMBO_MAX_SLOTS)
  .default([]);

/**
 * A combo's price for its whole set, in cents; 0 is free, as for a fixed price. Shared, as the
 * slots are, by the form and both mutations.
 */
const comboPriceSchema = z.coerce
  .number()
  .int()
  .nonnegative()
  .nullable()
  .default(null);

/**
 * Split from the refinement below because `superRefine` returns a ZodEffects, which has
 * no `.extend()` - the update schema has to branch off the plain object.
 */
const offerFields = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  image: z.string().min(1).nullable().default(null),
  isActive: z.boolean().default(false),
  startsAt: z.date().nullable().default(null),
  endsAt: z.date().nullable().default(null),
  audience: z.enum(["MEMBERS", "EVERYONE", "NEW_USERS"]),
  dessertId: z.string().min(1).nullable().default(null),
  categoryId: z.string().min(1).nullable().default(null),
  /**
   * Desserts in `categoryId` this offer leaves out. Meaningless without a category, so
   * the router stores an empty list for an offer on one dessert; it also checks every id
   * is in the category, which zod cannot see from here.
   */
  excludedDessertIds: z.array(z.string().min(1)).default([]),
  /**
   * Cents, and **0 is legal**: it is how a free item is expressed, and both of the
   * shop's giveaway offers are stored that way. The rule that it must come in under the
   * item's list price is enforced in the router - it compares against another table, so
   * neither zod nor a CHECK constraint can see it here.
   */
  itemPriceInCents: z.coerce
    .number()
    .int()
    .nonnegative()
    .nullable()
    .default(null),
  /** Whole percent. 0 is not a discount and 100 is the whole thing. */
  discountAmount: z.coerce
    .number()
    .int()
    .min(DISCOUNT_MIN_PERCENT)
    .max(DISCOUNT_MAX_PERCENT)
    .nullable()
    .default(null),
  limit: z.coerce.number().int().positive().default(1),
  /**
   * Whether this offer's usage counter clears every Monday, making `limit` an allowance
   * per week rather than per run. The order server's weekly cron reads this to decide
   * which offers to reset - before the flag existed it reset every redemption row in the
   * database, which would hand back requirement-gated offers a shop had deliberately
   * closed the run on.
   */
  renewsWeekly: z.boolean().default(false),
  requirements: offerRequirementsSchema,
  /**
   * A combo (20261125000000_offer_combos): one price for its set, and the parts the customer
   * picks one dessert for each. Both empty on a single-item offer. An offer cannot switch
   * between the two once made; the router refuses it.
   */
  comboPriceInCents: comboPriceSchema,
  comboSlots: offerComboSlotsSchema,
});

/**
 * Exactly one way to price an offer.
 *
 * Both set used to be accepted and the discount silently ignored, so a row could read
 * "50% off" while every customer was charged the fixed price. Neither set was accepted
 * too, giving an offer that discounts nothing.
 *
 * The issue is attached to both fields so whichever one the admin is looking at carries
 * the message. Safe to enforce here despite the usual worry that a rule stricter than
 * the column stops a running offer loading into its own edit form: all three live offers
 * were audited against it first and all three already comply.
 */
const refineOfferPricing = (
  offer: {
    itemPriceInCents: number | null;
    discountAmount: number | null;
    comboPriceInCents: number | null;
  },
  ctx: z.RefinementCtx,
) => {
  if (hasExactlyOnePrice(offer)) return;

  // A combo has one price for its set; anything else set beside it is the mistake.
  if (offer.comboPriceInCents !== null) {
    for (const path of ["itemPriceInCents", "discountAmount"] as const) {
      if (offer[path] === null) continue;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [path],
        message: "A combo has one price for the whole set. Clear this one.",
      });
    }
    return;
  }

  const message =
    offer.itemPriceInCents === null
      ? "Set a fixed price or a discount - an offer needs one of them."
      : "Set a fixed price or a discount, not both.";

  for (const path of ["itemPriceInCents", "discountAmount"] as const) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  }
};

/**
 * A combo's shape: 2-4 parts, and no dessert, category or exclusions of its own - its desserts
 * are its parts, and an offer naming a category too would be listed and priced as a single
 * item by every app build that does not know combos. Any other offer has no parts.
 */
const refineCombo = (
  offer: {
    comboPriceInCents: number | null;
    comboSlots: unknown[];
    dessertId: string | null;
    categoryId: string | null;
    excludedDessertIds?: string[];
  },
  ctx: z.RefinementCtx,
) => {
  if (offer.comboPriceInCents === null) {
    if (offer.comboSlots.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["comboSlots"],
        message: "Only a combo has parts.",
      });
    }
    return;
  }

  if (
    offer.comboSlots.length < COMBO_MIN_SLOTS ||
    offer.comboSlots.length > COMBO_MAX_SLOTS
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["comboSlots"],
      message: `A combo has ${COMBO_MIN_SLOTS} to ${COMBO_MAX_SLOTS} parts.`,
    });
  }

  if (
    offer.dessertId !== null ||
    offer.categoryId !== null ||
    (offer.excludedDessertIds?.length ?? 0) > 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["comboSlots"],
      message:
        "A combo's desserts are its parts. It names no dessert or category of its own.",
    });
  }
};

const refineOffer = (
  offer: Parameters<typeof refineOfferPricing>[0] & Parameters<typeof refineCombo>[0],
  ctx: z.RefinementCtx,
) => {
  refineOfferPricing(offer, ctx);
  refineCombo(offer, ctx);
};

/** The offer dialog's form, whose dates are the calendar controls' `Date`s. */
export const offerFormSchema = offerFields.superRefine(refineOffer);

/**
 * An offer as `createOffer` and `updateOffer` receive it: the form, with each date as the
 * calendar day the admin saw ("2026-10-31") rather than the calendar's `Date`.
 *
 * The router turns those into the first instant of the start day and the last instant of
 * the end day, in Auckland - see `src/lib/aucklandDay.ts`. The form's dates used to be
 * stored as they came: midnight at the *start* of each day, so an offer set to end on the
 * 31st stopped as the 31st began.
 */
const offerInputFields = offerFields
  .omit({ startsAt: true, endsAt: true })
  .extend({
    startsOn: z.string().date().nullable().default(null),
    endsOn: z.string().date().nullable().default(null),
    /**
     * Optional on the wire, where the form's own default would read a missing list as
     * "leave nothing out". A tab opened before exclusions existed sends none, and its
     * next save would have wiped the list - so the router keeps the stored one instead.
     */
    excludedDessertIds: z.array(z.string().min(1)).optional(),
  });

export const createOfferSchema = offerInputFields.superRefine(refineOffer);

export const updateOfferSchema = offerInputFields
  .extend({ id: z.string().min(1) })
  .superRefine(refineOffer);

/**
 * Assigning or editing a monthly winner's prize.
 *
 * Deliberately carries no `code`, `redeemedAt`, `redeemedByAdminId` or
 * `assignedByAdminId`: the code is minted server-side, and redemption happens at the
 * counter through the admin mobile app. There is no request shape this website can send
 * that marks a prize collected.
 */
export const upsertRewardSchema = z.object({
  winnerId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  expiresAt: z.date(),
});

/**
 * What `winner.upsertReward` receives: the form, with the expiry as the calendar day the
 * admin saw ("2026-10-31") rather than the calendar's `Date`.
 *
 * The calendar hands back midnight in the browser's timezone, and only the browser knows
 * which day that was. The router used to read the day off the `Date` itself, which is
 * right on a machine in Auckland and a day early on Vercel, which runs in UTC.
 *
 * Optional because an edit that leaves the date alone sends none, and the order server
 * then keeps the deadline it has.
 */
export const upsertRewardInputSchema = upsertRewardSchema
  .omit({ expiresAt: true })
  .extend({ expiresOn: z.string().date().optional() });

/**
 * A finished month to settle by hand, for when the order server's cron missed NZ midnight
 * on the 1st. The order server refuses the month still being competed for; the dialog only
 * offers finished months, so that refusal should never be seen.
 */
export const settleMonthSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000),
});

/**
 * An admin moving an order's status from the Orders or Past Orders table, through the order
 * server. `expectedStatus` is the status the table showed, which may be minutes old: the
 * order server moves the order only if it is still there, so a tablet's move since is never
 * undone. Neither may be PENDING or CANCELLED - see `STAFF_STATUSES`.
 */
export const changeOrderStatusSchema = z
  .object({
    orderId: z.string().min(1),
    newStatus: z.enum(STAFF_STATUSES),
    expectedStatus: z.enum(STAFF_STATUSES),
  })
  .refine((change) => change.newStatus !== change.expectedStatus, {
    message: "The order already has that status",
    path: ["newStatus"],
  });

/**
 * The shop settings that moved out of the order server's code and into the database.
 *
 * Bounds come from `~/lib/shopSettings`, which is also what the CHECK constraints in
 * 20260919000000_shop_settings_from_code enforce, so the form refuses what Postgres would
 * refuse instead of surfacing a constraint violation to an admin.
 */
export const loyaltyRatesSchema = z.object({
  pointsPerDollar: z.coerce
    .number()
    .int()
    .min(POINTS_PER_DOLLAR_MIN)
    .max(POINTS_PER_DOLLAR_MAX),
  memberBonusPercent: z.coerce
    .number()
    .int()
    .min(MEMBER_BONUS_PERCENT_MIN)
    .max(MEMBER_BONUS_PERCENT_MAX),
  modifierPercent: z.coerce
    .number()
    .int()
    .min(MODIFIER_PERCENT_MIN)
    .max(MODIFIER_PERCENT_MAX),
});

/**
 * Switching points expiry on or off. Just the switch: the moment it went on is stamped by
 * the server, never sent, because that moment is every customer's launch grace and a
 * browser's clock is not one to count a month from.
 */
export const pointsExpirySchema = z.object({
  enabled: z.boolean(),
});

/** Showing or hiding the leaderboard in the customer app. The moment is stamped by the server. */
export const leaderboardVisibilitySchema = z.object({
  shown: z.boolean(),
});

/**
 * A save from the days-off card: the Auckland days to close and to reopen, as the calendar
 * showed them ("2026-12-25"). The change rather than the list, because the staff app's
 * tablets edit the same days - see `~/lib/daysOff`. A year each way is far more than anyone
 * changes at once, and keeps one request from writing a table's worth of rows.
 */
export const saveDaysOffSchema = z
  .object({
    added: z.array(z.string().date()).max(366),
    removed: z.array(z.string().date()).max(366),
  })
  .refine(({ added, removed }) => !added.some((day) => removed.includes(day)), {
    message: "A day can't be closed and reopened in the same save.",
  });

/**
 * The shop's own details. Every field is required: these are served to the customer app as
 * one object and a blank address is worse than a stale one.
 */
export const shopProfileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  address: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  postal: z.string().trim().min(1).max(20),
  phone: z.string().trim().min(1).max(30),
  email: z.string().trim().email().max(254),
  website: z.string().trim().url().max(200),
  /**
   * Optional, unlike the rest: the app shows the paragraph it was built with until the shop
   * writes one, and `saveShopProfile` stores a blank as null to hand it back to that text.
   */
  about: z.string().trim().max(SHOP_ABOUT_MAX_LENGTH).optional(),
});

/**
 * The membership benefits, in the order the app lists them.
 *
 * At least one, because an empty list renders as a membership offering nothing. Blank rows
 * are dropped before the length is checked, so an admin who clears a field and saves gets
 * the row removed rather than an empty bullet on the join screen.
 */
export const membershipBenefitsSchema = z.object({
  benefits: z
    .array(z.string().trim().max(BENEFIT_MAX_LENGTH))
    .transform((list) => list.filter((benefit) => benefit.length > 0))
    .pipe(z.array(z.string().min(1)).min(1)),
});

/**
 * The same benefits as the card's form holds them: one object per row, because
 * `useFieldArray` tracks rows by object identity and cannot key an array of bare strings.
 *
 * Blank rows are allowed here and dropped on submit by the schema above. Resolving the form
 * against that one instead would reject the whole list the moment an admin cleared a field
 * to retype it, because its `min(1)` runs after the blanks are filtered out.
 */
export const membershipBenefitsFormSchema = z.object({
  benefits: z.array(
    z.object({ value: z.string().trim().max(BENEFIT_MAX_LENGTH) }),
  ),
});

/**
 * One announcement.
 *
 * `id` is present for rows that already exist and absent for one the admin just added, which
 * is how `saveAnnouncements` tells an update from an insert.
 *
 * Split from the two schemas below because the form and the wire disagree about the date and
 * about nothing else - the same split as an offer's dates and a prize's expiry.
 */
const announcementFields = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(ANNOUNCEMENT_TITLE_MAX_LENGTH),
  text1: z.string().trim().min(1).max(ANNOUNCEMENT_TEXT_MAX_LENGTH),
  text2: z.string().trim().max(ANNOUNCEMENT_TEXT_MAX_LENGTH).optional(),
  isActive: z.boolean(),
  publishedAt: z.date(),
  /** The last day it shows. Null shows it until it is switched off. */
  endsAt: z.date().nullable().default(null),
});

const END_BEFORE_DATE =
  "The end date is before the announcement's date, so it would never show.";

/**
 * The card's form, whose dates are the calendar controls' own `Date`s.
 *
 * The end is checked against the date by the day each shows, through `pickedDay`, rather
 * than as instants: a new row's date is the moment it was added, so an end picked for that
 * same day is an earlier instant and would be refused. The form runs in the browser, which
 * is where `pickedDay` is right.
 */
export const announcementsFormSchema = z.object({
  announcements: z.array(
    announcementFields.superRefine((a, ctx) => {
      if (a.endsAt && pickedDay(a.endsAt) < pickedDay(a.publishedAt)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endsAt"],
          message: END_BEFORE_DATE,
        });
      }
    }),
  ),
});

/**
 * One announcement as `saveAnnouncements` receives it: the form's row, with the date as the
 * calendar day the admin saw ("2026-10-31") rather than the calendar's `Date`.
 *
 * `pickedDay` reads that day in the browser, because only the browser knows which day the
 * control's midnight belonged to; the server then pins it to an Auckland instant. Reading it
 * from the `Date` on the server is right in Auckland and a day early on Vercel, which runs
 * in UTC - the bug that made every offer end a day too soon.
 *
 * The date is separate from the row's own `updatedAt` on purpose: the app treats a later one
 * as a new announcement worth re-showing, so correcting a typo must not reach for it.
 */
export const announcementSchema = announcementFields
  .omit({ publishedAt: true, endsAt: true })
  .extend({
    publishedOn: z.string().date(),
    /**
     * Null clears the end. Absent keeps whatever is stored: an admin tab opened before end
     * dates existed sends no field, and reading that as null erased an end set since.
     */
    endsOn: z.string().date().nullable().optional(),
  })
  .refine((a) => a.endsOn == null || a.endsOn >= a.publishedOn, {
    message: END_BEFORE_DATE,
    path: ["endsOn"],
  });

export const saveAnnouncementsSchema = z.object({
  /**
   * The ids the form was opened with.
   *
   * Saving replaces the whole list, so without this a tab opened before another admin added
   * an announcement would delete it on save and say nothing. The server compares this with
   * what is actually there and refuses a stale submission.
   */
  knownIds: z.array(z.string().min(1)),
  announcements: z
    .array(announcementSchema)
    // One that has ended is no more showing than one switched off.
    .refine(
      (list) =>
        list.filter((a) =>
          isAnnouncementShowing(
            { isActive: a.isActive, endsOn: a.endsOn ?? null },
            todayNZ(),
          ),
        ).length <= MAX_ACTIVE_ANNOUNCEMENTS,
      `At most ${MAX_ACTIVE_ANNOUNCEMENTS} announcements can be showing at once`,
    ),
});
