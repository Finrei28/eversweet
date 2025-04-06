import { z } from "zod";

const fileSchema = z.instanceof(File, { message: "File is required" });
export const imageSchema = fileSchema.refine(
  (file) => file.size === 0 || file.type.startsWith("image/"),
);

export const addSchema = z.object({
  name: z.string().min(1),
  chineseName: z.string().min(1),
  priceInCents: z.coerce.number().int().min(1),
  description: z.string().optional(),
  ingredients: z.string().optional(),
  image: imageSchema.refine((file) => file.size > 0, "Image is Required"),
  categoryId: z.string().min(1),
});

export const createProductSchema = z.object({
  name: z.string().min(1),
  chineseName: z.string().min(1),
  priceInCents: z.coerce.number().int().min(1),
  description: z.string().optional(),
  ingredients: z.string().optional(),
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
});
