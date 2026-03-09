import { z } from "zod";
import { MASS_CIRCULATION_CURRENCY_CODE_SET } from "@/lib/currencies";

export const mastodonStartSchema = z.object({
  instance: z.string().min(3).max(100),
  callbackUrl: z.string().optional(),
});

const currencyCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => MASS_CIRCULATION_CURRENCY_CODE_SET.has(value), {
    message: "Unsupported currency code",
  });

export const listingCreateSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(5000),
  priceAmount: z.number().nonnegative().max(1_000_000).optional().nullable(),
  priceCurrency: currencyCodeSchema.optional().nullable(),
  location: z.string().max(120).optional().nullable(),
  category: z.string().max(60).optional().nullable(),
  imageKeys: z.array(z.string().min(1)).max(6).optional().default([]),
});

export const listingUpdateSchema = listingCreateSchema.partial().extend({
  status: z.enum(["ACTIVE", "SOLD", "REMOVED"]).optional(),
});
