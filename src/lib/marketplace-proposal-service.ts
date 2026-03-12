import { MarketplaceProposalPurpose, MarketplaceProposalStatus, Prisma } from "@prisma/client";
import { listingProposalObjectId } from "@/lib/activitypub";
import { prisma } from "@/lib/prisma";

type ListingForProposal = Prisma.ListingGetPayload<{
  include: {
    owner: {
      select: {
        mastodonActorUri: true;
      };
    };
    images: {
      orderBy: {
        position: "asc";
      };
    };
  };
}>;

function listingStatusToProposalStatus(status: "ACTIVE" | "SOLD" | "REMOVED"): MarketplaceProposalStatus {
  if (status === "REMOVED") {
    return "WITHDRAWN";
  }
  if (status === "SOLD") {
    return "FULFILLED";
  }

  return "PUBLISHED";
}

export function proposalPurposeToWire(purpose: MarketplaceProposalPurpose) {
  return purpose === "REQUEST" ? "request" : "offer";
}

function categoryResourceUri(category: string | null) {
  if (!category) {
    return "https://schema.org/Product";
  }

  return `urn:feditrade:category:${encodeURIComponent(category.toLowerCase())}`;
}

function quantityPayload(value: string, unitCode: string | null) {
  return {
    hasNumericalValue: Number(value),
    ...(unitCode ? { hasUnit: unitCode } : {}),
  };
}

function buildPublishedIntentJson(listing: ListingForProposal) {
  const quantity = listing.availableQuantity?.toString() ?? "1";

  return {
    type: "Intent",
    action: "transfer",
    provider: listing.owner.mastodonActorUri,
    resourceConformsTo: listing.resourceConformsTo ?? categoryResourceUri(listing.category),
    resourceQuantity: quantityPayload(quantity, listing.unitCode),
    availableQuantity: quantityPayload(quantity, listing.unitCode),
    ...(listing.minimumQuantity
      ? {
          minimumQuantity: quantityPayload(listing.minimumQuantity.toString(), listing.unitCode),
        }
      : {}),
  } satisfies Record<string, unknown>;
}

function buildReciprocalIntentJson(listing: ListingForProposal) {
  if (!listing.priceAmount || !listing.priceCurrency) {
    return null;
  }

  return {
    type: "Intent",
    action: "transfer",
    receiver: listing.owner.mastodonActorUri,
    resourceConformsTo: `urn:iso:std:iso:4217:${listing.priceCurrency.toUpperCase()}`,
    resourceQuantity: {
      hasNumericalValue: Number(listing.priceAmount.toString()),
      hasUnit: listing.priceCurrency.toUpperCase(),
    },
  } satisfies Record<string, unknown>;
}

function toNullableJsonValue(value: Record<string, unknown> | null) {
  if (value) {
    return value as Prisma.InputJsonValue;
  }

  return Prisma.DbNull;
}

export async function syncMarketplaceProposalForListing(listing: ListingForProposal) {
  const availableQuantity = listing.availableQuantity?.toString() ?? "1";
  const numericAvailableQuantity = Number(availableQuantity);
  const unitBased =
    Number.isFinite(numericAvailableQuantity) &&
    (numericAvailableQuantity > 1 || listing.minimumQuantity !== null);

  return prisma.marketplaceProposal.upsert({
    where: {
      listingId: listing.id,
    },
    update: {
      activityPubId: listingProposalObjectId(listing.id),
      actorId: listing.owner.mastodonActorUri,
      purpose: listing.proposalPurpose,
      status: listingStatusToProposalStatus(listing.status),
      publishedIntentJson: buildPublishedIntentJson(listing) as Prisma.InputJsonValue,
      reciprocalIntentJson: toNullableJsonValue(buildReciprocalIntentJson(listing)),
      unitBased,
      availableQuantity: listing.availableQuantity,
      minimumQuantity: listing.minimumQuantity,
      unitCode: listing.unitCode,
      resourceConformsTo: listing.resourceConformsTo,
      validFrom: listing.validFrom,
      validUntil: listing.validUntil,
      lastAnnouncedAt: new Date(),
    },
    create: {
      listingId: listing.id,
      activityPubId: listingProposalObjectId(listing.id),
      actorId: listing.owner.mastodonActorUri,
      purpose: listing.proposalPurpose,
      status: listingStatusToProposalStatus(listing.status),
      publishedIntentJson: buildPublishedIntentJson(listing) as Prisma.InputJsonValue,
      reciprocalIntentJson: toNullableJsonValue(buildReciprocalIntentJson(listing)),
      unitBased,
      availableQuantity: listing.availableQuantity,
      minimumQuantity: listing.minimumQuantity,
      unitCode: listing.unitCode,
      resourceConformsTo: listing.resourceConformsTo,
      validFrom: listing.validFrom,
      validUntil: listing.validUntil,
      lastAnnouncedAt: new Date(),
    },
  });
}

export async function getMarketplaceProposalByListingId(listingId: string) {
  return prisma.marketplaceProposal.findUnique({
    where: { listingId },
    include: {
      listing: {
        include: {
          owner: {
            select: {
              mastodonActorUri: true,
              mastodonUsername: true,
              mastodonDomain: true,
            },
          },
          images: {
            orderBy: {
              position: "asc",
            },
          },
        },
      },
    },
  });
}

export async function getMarketplaceProposalByActivityPubId(activityPubId: string) {
  return prisma.marketplaceProposal.findUnique({
    where: {
      activityPubId,
    },
    include: {
      listing: {
        include: {
          owner: {
            select: {
              id: true,
              mastodonActorUri: true,
              mastodonUsername: true,
              mastodonDomain: true,
            },
          },
          images: {
            orderBy: {
              position: "asc",
            },
          },
        },
      },
    },
  });
}
