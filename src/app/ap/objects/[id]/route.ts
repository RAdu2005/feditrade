import { jsonError, jsonOk } from "@/lib/http";
import { getListingRecordById } from "@/lib/listing-service";
import { createListingNote } from "@/lib/activitypub";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: Params) {
  const { id } = await context.params;
  const listing = await getListingRecordById(id);
  if (!listing || listing.status === "REMOVED") {
    return jsonError("Object not found", 404);
  }

  const note = createListingNote({
    id: listing.activityPubObjectId,
    title: listing.title,
    description: listing.description,
    canonicalUrl: listing.canonicalUrl,
    ownerActorUri: listing.owner.mastodonActorUri,
    priceAmount: listing.priceAmount?.toString(),
    priceCurrency: listing.priceCurrency,
    category: listing.category,
    location: listing.location,
    imageAttachments: listing.images.map((image) => ({
      url: image.url,
      mediaType: image.contentType,
    })),
    updatedAt: listing.updatedAt,
  });

  return jsonOk(note, {
    headers: {
      "content-type": "application/activity+json",
    },
  });
}
