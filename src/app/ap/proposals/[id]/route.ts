import { jsonError, jsonOk } from "@/lib/http";
import { createMarketplaceProposalObject } from "@/lib/activitypub-marketplace";
import { getMarketplaceProposalByListingId } from "@/lib/marketplace-proposal-service";

type Params = {
  params: Promise<{ id: string }>;
};

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export async function GET(_: Request, context: Params) {
  const { id } = await context.params;
  const proposal = await getMarketplaceProposalByListingId(id);
  if (!proposal || proposal.status === "WITHDRAWN") {
    return jsonError("Proposal not found", 404);
  }

  const proposalObject = createMarketplaceProposalObject({
    id: proposal.activityPubId,
    canonicalUrl: proposal.listing.canonicalUrl,
    title: proposal.listing.title,
    description: proposal.listing.description,
    ownerActorUri: proposal.listing.owner.mastodonActorUri,
    ownerHandle: `@${proposal.listing.owner.mastodonUsername}@${proposal.listing.owner.mastodonDomain}`,
    updatedAt: proposal.listing.updatedAt,
    purpose: proposal.purpose === "REQUEST" ? "request" : "offer",
    publishes: asRecord(proposal.publishedIntentJson),
    reciprocal: proposal.reciprocalIntentJson ? asRecord(proposal.reciprocalIntentJson) : null,
    unitBased: proposal.unitBased,
    availableQuantity: proposal.availableQuantity
      ? {
          value: proposal.availableQuantity.toString(),
          unitCode: proposal.unitCode,
        }
      : null,
    minimumQuantity: proposal.minimumQuantity
      ? {
          value: proposal.minimumQuantity.toString(),
          unitCode: proposal.unitCode,
        }
      : null,
    location: proposal.listing.location,
    imageAttachments: proposal.listing.images.map((image) => ({
      url: image.url,
      mediaType: image.contentType,
    })),
  });

  return jsonOk(proposalObject, {
    headers: {
      "content-type": "application/activity+json",
    },
  });
}
