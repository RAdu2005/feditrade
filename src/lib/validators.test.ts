import {
  listingCreateSchema,
  listingMarketplaceOfferSchema,
  outboundMarketplaceOfferSchema,
} from "@/lib/validators";

describe("validators", () => {
  const futureValidUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  it("accepts valid listing payload", () => {
    const parsed = listingCreateSchema.safeParse({
      title: "MacBook Pro",
      description: "Used laptop in good condition",
      priceAmount: 850,
      priceCurrency: "EUR",
      location: "Helsinki, Finland",
      category: "Electronics & Appliances",
      imageKeys: ["listings/2026-01-01/sample.jpg"],
      proposalPurpose: "offer",
      availableQuantity: 2,
      minimumQuantity: 1,
      unitCode: "EA",
      resourceConformsTo: "https://schema.org/Product",
      validUntil: futureValidUntil,
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts request listing payload without images", () => {
    const parsed = listingCreateSchema.safeParse({
      title: "Looking for office chair",
      description: "Need an ergonomic chair in good condition",
      priceAmount: 120,
      priceCurrency: "EUR",
      location: "Helsinki, Finland",
      category: "Home & Garden",
      imageKeys: [],
      proposalPurpose: "request",
      availableQuantity: 1,
      minimumQuantity: 1,
      unitCode: "EA",
      resourceConformsTo: "https://schema.org/Product",
      validUntil: futureValidUntil,
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects offer listing payload without images", () => {
    const parsed = listingCreateSchema.safeParse({
      title: "MacBook Pro",
      description: "Used laptop in good condition",
      priceAmount: 850,
      priceCurrency: "EUR",
      location: "Helsinki, Finland",
      category: "Electronics & Appliances",
      imageKeys: [],
      proposalPurpose: "offer",
      availableQuantity: 2,
      minimumQuantity: 1,
      unitCode: "EA",
      resourceConformsTo: "https://schema.org/Product",
      validUntil: futureValidUntil,
    });

    expect(parsed.success).toBe(false);
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
      proposalPurpose: "offer",
      availableQuantity: 2,
      minimumQuantity: 1,
      unitCode: "EA",
      resourceConformsTo: "https://schema.org/Product",
      validUntil: futureValidUntil,
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

  it("rejects listing payload with past validUntil", () => {
    const parsed = listingCreateSchema.safeParse({
      title: "MacBook Pro",
      description: "Used laptop in good condition",
      priceAmount: 850,
      priceCurrency: "EUR",
      location: "Helsinki, Finland",
      category: "Electronics & Appliances",
      imageKeys: ["listings/2026-01-01/sample.jpg"],
      proposalPurpose: "offer",
      availableQuantity: 2,
      minimumQuantity: 1,
      unitCode: "EA",
      resourceConformsTo: "https://schema.org/Product",
      validUntil: new Date(Date.now() - 60_000).toISOString(),
    });

    expect(parsed.success).toBe(false);
  });
});
