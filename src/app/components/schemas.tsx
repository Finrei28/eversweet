import { z } from "zod";

import {
  DISCOUNT_MAX_PERCENT,
  DISCOUNT_MIN_PERCENT,
  hasExactlyOnePrice,
} from "~/lib/offerPricing";

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

export const editSchema = addSchema.extend({
  image: imageSchema.optional(),
  isAvailableForPurchase: z.boolean(),
});

export const updateProductSchema = createProductSchema.extend({
  id: z.string().min(1),
  imagePath: z.string().optional(),
  imagePublicId: z.string().optional(),
  isAvailableForPurchase: z.boolean(),
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
 * One requirement row on an offer: so many of a dessert, or so many from a category.
 *
 * `id` is present for rows that already exist in the database and absent for rows the
 * admin just added. The update mutation uses that to patch rather than delete and
 * recreate, so requirement ids survive an unrelated edit.
 */
export const offerRequirementSchema = z
  .object({
    id: z.string().min(1).optional(),
    dessertId: z.string().min(1).nullable().default(null),
    categoryId: z.string().min(1).nullable().default(null),
    quantity: z.coerce.number().int().positive(),
  })
  .refine(
    (r) => (r.dessertId === null) !== (r.categoryId === null),
    "Pick either a dessert or a category, not both",
  );

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
  requirements: z.array(offerRequirementSchema).default([]),
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
  offer: { itemPriceInCents: number | null; discountAmount: number | null },
  ctx: z.RefinementCtx,
) => {
  if (hasExactlyOnePrice(offer)) return;

  const message =
    offer.itemPriceInCents === null
      ? "Set a fixed price or a discount - an offer needs one of them."
      : "Set a fixed price or a discount, not both.";

  for (const path of ["itemPriceInCents", "discountAmount"] as const) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  }
};

/** The offer dialog's form, whose dates are the calendar controls' `Date`s. */
export const offerFormSchema = offerFields.superRefine(refineOfferPricing);

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
  });

export const createOfferSchema =
  offerInputFields.superRefine(refineOfferPricing);

export const updateOfferSchema = offerInputFields
  .extend({ id: z.string().min(1) })
  .superRefine(refineOfferPricing);

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
