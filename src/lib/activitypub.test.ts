import {
  createActivity,
  createListingNote,
  listingsActorDocument,
  listingsActorId,
  webfingerResponse,
} from "@/lib/activitypub";

describe("activitypub helpers", () => {
  it("builds the shared listings actor document", () => {
    const actor = listingsActorDocument();
    expect(actor.id).toBe(listingsActorId());
    expect(actor.type).toBe("Service");
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
});
