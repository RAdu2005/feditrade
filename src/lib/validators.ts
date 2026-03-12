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

const futureDateTimeSchema = z.string().datetime().refine((value) => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.getTime() > Date.now();
}, {
  message: "Date must be in the future",
});

const requiredListingFieldsSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(5000),
  priceAmount: z.number().positive().max(1_000_000),
  priceCurrency: currencyCodeSchema,
  location: z.string().trim().min(2).max(160),
  category: z.string().trim().min(2).max(60),
  imageKeys: z.array(z.string().min(1)).min(1).max(6),
  proposalPurpose: z.enum(["offer", "request"]),
  availableQuantity: z.number().positive().max(1_000_000),
  minimumQuantity: z.number().positive().max(1_000_000),
  unitCode: z.string().trim().min(1).max(30),
  resourceConformsTo: z.string().trim().url(),
  validFrom: z.string().datetime().nullable().optional(),
  validUntil: futureDateTimeSchema,
}).superRefine((value, context) => {
  if (value.minimumQuantity > value.availableQuantity) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["minimumQuantity"],
      message: "Minimum quantity cannot be greater than available quantity",
    });
  }
});

export const listingCreateSchema = requiredListingFieldsSchema;

export const listingUpdateSchema = requiredListingFieldsSchema.extend({
  status: z.enum(["ACTIVE", "SOLD", "REMOVED"]).optional(),
});

export const outboundMarketplaceOfferSchema = z.object({
  targetProposalId: z.string().trim().url(),
  targetActorId: z.string().trim().url(),
  targetInbox: z.string().trim().url().optional().nullable(),
  note: z.string().trim().max(3000).optional().nullable(),
  quantity: z.number().positive().max(1_000_000).optional().nullable(),
  unitCode: z.string().trim().min(1).max(30).optional().nullable(),
  amount: z.number().positive().max(1_000_000).optional().nullable(),
  currency: currencyCodeSchema.optional().nullable(),
});

export const listingMarketplaceOfferSchema = z.object({
  note: z.string().trim().max(3000).optional().nullable(),
  quantity: z.number().positive().max(1_000_000),
  unitCode: z.string().trim().min(1).max(30),
  amount: z.number().positive().max(1_000_000),
  currency: currencyCodeSchema,
});
