import {
  VALUEFLOWS_CONTEXT,
  createMarketplaceAgreementObject,
  createMarketplaceConfirmationDocument,
  createMarketplaceProposalObject,
} from "@/lib/activitypub-marketplace";

describe("activitypub marketplace serialization", () => {
  it("serializes proposal objects with FEP fields", () => {
    const proposal = createMarketplaceProposalObject({
      id: "https://example.test/ap/proposals/abc",
      canonicalUrl: "https://example.test/listings/abc",
      title: "Vintage camera",
      description: "Working and recently serviced",
      ownerActorUri: "https://remote.example/users/seller",
      ownerHandle: "@seller@remote.example",
      updatedAt: new Date("2026-03-12T10:00:00.000Z"),
      purpose: "offer",
      publishes: {
        type: "Intent",
        resourceConformsTo: "https://schema.org/Product",
      },
      reciprocal: {
        type: "Intent",
        resourceConformsTo: "urn:iso:std:iso:4217:EUR",
      },
      unitBased: true,
      availableQuantity: {
        value: "3",
        unitCode: "EA",
      },
      minimumQuantity: {
        value: "1",
        unitCode: "EA",
      },
      location: "Kyiv, Ukraine",
      imageAttachments: [{ url: "https://cdn.example/camera.jpg", mediaType: "image/jpeg" }],
    });

    const contexts = proposal["@context"] as unknown[];
    expect(contexts).toContain(VALUEFLOWS_CONTEXT);
    expect(proposal.type).toBe("Proposal");
    expect(proposal.purpose).toBe("offer");
    expect(proposal.publishes).toEqual(
      expect.objectContaining({
        type: "Intent",
      }),
    );
    expect(proposal.reciprocal).toEqual(
      expect.objectContaining({
        type: "Intent",
      }),
    );
    expect(proposal.availableQuantity).toEqual(
      expect.objectContaining({
        hasNumericalValue: 3,
        hasUnit: "EA",
      }),
    );
  });

  it("serializes agreement objects", () => {
    const agreement = createMarketplaceAgreementObject({
      id: "https://example.test/ap/agreements/1",
      proposalId: "https://example.test/ap/proposals/abc",
      sellerActorId: "https://example.test/ap/actor/listings",
      buyerActorId: "https://remote.example/users/buyer",
      acceptedAt: new Date("2026-03-12T10:00:00.000Z"),
      agreement: {
        type: "Agreement",
        terms: "Pay on pickup",
      },
    });

    expect(agreement.type).toBe("Agreement");
    expect(agreement.basedOn).toBe("https://example.test/ap/proposals/abc");
    expect(agreement.provider).toBe("https://example.test/ap/actor/listings");
    expect(agreement.receiver).toBe("https://remote.example/users/buyer");
  });

  it("serializes completion confirmation documents", () => {
    const confirmation = createMarketplaceConfirmationDocument({
      id: "https://example.test/ap/agreements/1#confirmation",
      agreementId: "https://example.test/ap/agreements/1",
      proposalId: "https://example.test/ap/proposals/abc",
      completedAt: new Date("2026-03-12T10:00:00.000Z"),
    });

    expect(confirmation.type).toBe("Document");
    expect(confirmation.about).toBe("https://example.test/ap/agreements/1");
    expect(confirmation.basedOn).toBe("https://example.test/ap/proposals/abc");
  });
});
