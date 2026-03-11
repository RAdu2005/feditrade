import {
  createActivity,
  createListingNote,
  listingsActorDocument,
  listingsActorId,
  normalizeActorReference,
  webfingerResponse,
} from "@/lib/activitypub";

describe("activitypub helpers", () => {
  it("builds the shared listings actor document", () => {
    const actor = listingsActorDocument();
    expect(actor.id).toBe(listingsActorId());
    expect(actor.type).toBe("Service");
    expect(actor.manuallyApprovesFollowers).toBe(false);
    expect(actor.publicKey.id).toContain("#main-key");
  });

  it("serializes listing note objects", () => {
    const note = createListingNote({
      id: "https://example.test/ap/objects/1",
      title: "Bike",
      description: "Good condition",
      canonicalUrl: "https://example.test/listings/1",
      ownerActorUri: "https://mastodon.social/@seller",
      priceAmount: "50.00",
      priceCurrency: "EUR",
      updatedAt: new Date("2026-03-09T00:00:00.000Z"),
      imageUrls: ["https://cdn.example/bike.jpg"],
      category: "Sports",
      location: "Lappeenranta",
    });

    expect(note.type).toBe("Note");
    expect(note.url).toBe("https://example.test/listings/1");
    expect(note.attachment).toEqual([
      {
        type: "Image",
        url: "https://cdn.example/bike.jpg",
      },
    ]);
    expect(note.content).toContain("Seller:");
  });

  it("creates Create activities around objects", () => {
    const activity = createActivity({
      id: "activity-1",
      type: "Create",
      object: { id: "obj-1", type: "Note" },
    });

    expect(activity.type).toBe("Create");
    expect(activity.actor).toBe(listingsActorId());
  });

  it("returns WebFinger payload", () => {
    const jrd = webfingerResponse();
    expect(jrd.links[0].rel).toBe("self");
  });

  it("normalizes actor references from either string or object", () => {
    expect(normalizeActorReference("https://example.test/users/alice/")).toBe(
      "https://example.test/users/alice",
    );
    expect(normalizeActorReference({ id: "https://example.test/users/bob/" })).toBe(
      "https://example.test/users/bob",
    );
    expect(normalizeActorReference({ id: 123 })).toBeNull();
    expect(normalizeActorReference(null)).toBeNull();
  });
});
