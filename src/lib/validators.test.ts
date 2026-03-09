import { listingCreateSchema } from "@/lib/validators";

describe("validators", () => {
  it("accepts valid listing payload", () => {
    const parsed = listingCreateSchema.safeParse({
      title: "MacBook Pro",
      description: "Used laptop in good condition",
      priceAmount: 850,
      priceCurrency: "EUR",
      location: "Helsinki, Finland",
      category: "Electronics & Appliances",
      imageKeys: ["listings/2026-01-01/sample.jpg"],
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects non-circulating or unsupported currency", () => {
    const parsed = listingCreateSchema.safeParse({
      title: "MacBook Pro",
      description: "Used laptop in good condition",
      priceAmount: 850,
      priceCurrency: "XAU",
      location: "Helsinki, Finland",
      category: "Electronics & Appliances",
      imageKeys: ["listings/2026-01-01/sample.jpg"],
    });

    expect(parsed.success).toBe(false);
  });
});
