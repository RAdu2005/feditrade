import {
  listingCreateSchema,
  listingMarketplaceOfferSchema,
  outboundMarketplaceOfferSchema,
} from "@/lib/validators";

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

  it("accepts valid outbound marketplace offer payload", () => {
    const parsed = outboundMarketplaceOfferSchema.safeParse({
      targetProposalId: "https://remote.example/ap/proposals/abc",
      targetActorId: "https://remote.example/users/alice",
      quantity: 2,
      unitCode: "EA",
      amount: 120,
      currency: "EUR",
      note: "I can pay immediately.",
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts valid listing-integrated offer payload", () => {
    const parsed = listingMarketplaceOfferSchema.safeParse({
      quantity: 1,
      unitCode: "EA",
      amount: 75,
      currency: "EUR",
      note: "Can buy this week.",
    });

    expect(parsed.success).toBe(true);
  });
});
