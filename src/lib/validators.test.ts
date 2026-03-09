import { listingCreateSchema, signUploadSchema } from "@/lib/validators";

describe("validators", () => {
  it("accepts valid listing payload", () => {
    const parsed = listingCreateSchema.safeParse({
      title: "MacBook Pro",
      description: "Used laptop in good condition",
      priceAmount: 850,
      priceCurrency: "EUR",
      imageKeys: [],
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects unsupported upload types", () => {
    const parsed = signUploadSchema.safeParse({
      contentType: "application/pdf",
      sizeBytes: 1000,
    });
    expect(parsed.success).toBe(false);
  });
});
