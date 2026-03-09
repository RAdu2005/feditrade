import { listingCreateSchema } from "@/lib/validators";

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

  it("rejects non-circulating or unsupported currency", () => {
    const parsed = listingCreateSchema.safeParse({
      title: "MacBook Pro",
      description: "Used laptop in good condition",
      priceAmount: 850,
      priceCurrency: "XAU",
      imageKeys: [],
    });

    expect(parsed.success).toBe(false);
  });
});
