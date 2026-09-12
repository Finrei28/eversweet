import { z } from "zod";

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
  paymentIntentId: z.string().min(1),
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

export const createOfferSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  image: z.string().min(1).nullable().default(null),
  isActive: z.boolean().default(false),
  startsAt: z.date().nullable().default(null),
  endsAt: z.date().nullable().default(null),
  audience: z.enum(["MEMBERS", "EVERYONE", "NEW_USERS"]),
  dessertId: z.string().min(1).nullable().default(null),
  categoryId: z.string().min(1).nullable().default(null),
  itemPriceInCents: z.coerce
    .number()
    .int()
    .nonnegative()
    .nullable()
    .default(null),
  /**
   * Whole percent, 0-100. No refinement tying this to itemPriceInCents: any rule
   * stricter than what the column already holds would make an offer that is running
   * right now fail to load into its own edit form. The precedence
   * (itemPriceInCents wins) is helper text, not validation.
   */
  discountAmount: z.coerce
    .number()
    .int()
    .min(0)
    .max(100)
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

export const updateOfferSchema = createOfferSchema.extend({
  id: z.string().min(1),
});

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
