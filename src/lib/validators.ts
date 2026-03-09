import { z } from "zod";

export const mastodonStartSchema = z.object({
  instance: z.string().min(3).max(100),
  callbackUrl: z.string().optional(),
});

export const listingCreateSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(5000),
  priceAmount: z.number().nonnegative().max(1_000_000).optional().nullable(),
  priceCurrency: z.string().length(3).optional().nullable(),
  location: z.string().max(120).optional().nullable(),
  category: z.string().max(60).optional().nullable(),
  imageKeys: z.array(z.string().min(1)).max(6).optional().default([]),
});

export const listingUpdateSchema = listingCreateSchema.partial().extend({
  status: z.enum(["ACTIVE", "SOLD", "REMOVED"]).optional(),
});

export const signUploadSchema = z.object({
  contentType: z
    .string()
    .refine((value) => ["image/jpeg", "image/png", "image/webp"].includes(value), {
      message: "Unsupported content type",
    }),
  sizeBytes: z.number().int().positive().max(5 * 1024 * 1024),
});
