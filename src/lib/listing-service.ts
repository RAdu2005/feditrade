import { MarketplaceProposalPurpose, Prisma } from "@prisma/client";
import {
  createActivity,
  createListingNote,
  listingCanonicalUrl,
  listingObjectId,
} from "@/lib/activitypub";
import { createMarketplaceProposalObject } from "@/lib/activitypub-marketplace";
import { enqueueActivityDelivery } from "@/lib/delivery-queue";
import { env } from "@/lib/env";
import { syncMarketplaceProposalForListing } from "@/lib/marketplace-proposal-service";
import { decodeCursor, encodeCursor } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { getPublicObjectUrl } from "@/lib/s3";

const listingInclude = {
  images: {
    orderBy: {
      position: "asc",
    },
  },
  owner: {
    select: {
      id: true,
      image: true,
      mastodonActorUri: true,
      mastodonUsername: true,
      mastodonDomain: true,
    },
  },
  proposal: {
    select: {
      id: true,
      activityPubId: true,
      status: true,
      purpose: true,
      unitBased: true,
      availableQuantity: true,
      minimumQuantity: true,
      unitCode: true,
      validFrom: true,
      validUntil: true,
      publishedIntentJson: true,
      reciprocalIntentJson: true,
    },
  },
} satisfies Prisma.ListingInclude;

export type ListingWithRelations = Prisma.ListingGetPayload<{
  include: typeof listingInclude;
}>;

function listingToApi(listing: ListingWithRelations) {
  return {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    priceAmount: listing.priceAmount ? listing.priceAmount.toString() : null,
    priceCurrency: listing.priceCurrency,
    location: listing.location,
    category: listing.category,
    proposalPurpose: listing.proposalPurpose === "REQUEST" ? "request" : "offer",
    availableQuantity: listing.availableQuantity?.toString() ?? null,
    minimumQuantity: listing.minimumQuantity?.toString() ?? null,
    unitCode: listing.unitCode,
    resourceConformsTo: listing.resourceConformsTo,
    validFrom: listing.validFrom?.toISOString() ?? null,
    validUntil: listing.validUntil?.toISOString() ?? null,
    status: listing.status,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
    canonicalUrl: listing.canonicalUrl,
    proposalUrl: listing.proposal?.activityPubId ?? null,
    owner: {
      actorUri: listing.owner.mastodonActorUri,
      username: listing.owner.mastodonUsername,
      domain: listing.owner.mastodonDomain,
      image: listing.owner.image,
    },
    images: listing.images.map((image) => ({
      id: image.id,
      url: image.url,
      key: image.key,
      contentType: image.contentType,
      sizeBytes: image.sizeBytes,
      position: image.position,
    })),
  };
}

function toPrice(amount: number | null | undefined) {
  if (amount === null || amount === undefined) {
    return null;
  }
  return new Prisma.Decimal(amount.toFixed(2));
}

function toQuantity(amount: number | null | undefined) {
  if (amount === null || amount === undefined) {
    return null;
  }

  return new Prisma.Decimal(amount.toFixed(4));
}

function toProposalPurpose(value: "offer" | "request" | null | undefined): MarketplaceProposalPurpose {
  return value === "request" ? "REQUEST" : "OFFER";
}

function parseOptionalDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return null;
  }

  return parsed;
}

function asObjectRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function serializeLegacyActivity(listing: ListingWithRelations, type: "Create" | "Update" | "Delete") {
  if (type === "Delete") {
    return createActivity({
      type: "Delete",
      id: crypto.randomUUID(),
      object: listing.activityPubObjectId,
    });
  }

  const note = createListingNote({
    id: listing.activityPubObjectId,
    title: listing.title,
    description: listing.description,
    canonicalUrl: listing.canonicalUrl,
    proposalUrl: listing.proposal?.activityPubId,
    ownerActorUri: listing.owner.mastodonActorUri,
    ownerHandle: `@${listing.owner.mastodonUsername}@${listing.owner.mastodonDomain}`,
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

  return createActivity({
    type,
    id: crypto.randomUUID(),
    object: note,
  });
}

function serializeMarketplaceActivity(
  listing: ListingWithRelations,
  type: "Create" | "Update" | "Delete",
) {
  if (!listing.proposal) {
    return null;
  }

  if (type === "Delete") {
    return createActivity({
      type: "Delete",
      id: crypto.randomUUID(),
      object: listing.proposal.activityPubId,
    });
  }

  const proposalObject = createMarketplaceProposalObject({
    id: listing.proposal.activityPubId,
    canonicalUrl: listing.canonicalUrl,
    title: listing.title,
    description: listing.description,
    ownerActorUri: listing.owner.mastodonActorUri,
    ownerHandle: `@${listing.owner.mastodonUsername}@${listing.owner.mastodonDomain}`,
    updatedAt: listing.updatedAt,
    purpose: listing.proposal.purpose === "REQUEST" ? "request" : "offer",
    publishes: asObjectRecord(listing.proposal.publishedIntentJson),
    reciprocal: listing.proposal.reciprocalIntentJson
      ? asObjectRecord(listing.proposal.reciprocalIntentJson)
      : null,
    unitBased: listing.proposal.unitBased,
    availableQuantity: listing.proposal.availableQuantity
      ? {
          value: listing.proposal.availableQuantity.toString(),
          unitCode: listing.proposal.unitCode,
        }
      : null,
    minimumQuantity: listing.proposal.minimumQuantity
      ? {
          value: listing.proposal.minimumQuantity.toString(),
          unitCode: listing.proposal.unitCode,
        }
      : null,
    location: listing.location,
    imageAttachments: listing.images.map((image) => ({
      url: image.url,
      mediaType: image.contentType,
    })),
  });

  return createActivity({
    type,
    id: crypto.randomUUID(),
    object: proposalObject,
  });
}

async function publishListingActivities(
  listing: ListingWithRelations,
  type: "Create" | "Update" | "Delete",
) {
  if (env.AP_ENABLE_LEGACY_NOTES) {
    const legacyActivity = serializeLegacyActivity(listing, type);
    await enqueueActivityDelivery({
      id: legacyActivity.id,
      type: legacyActivity.type,
      listingId: listing.id,
      projectionType: "LEGACY_NOTE",
      proposalId: listing.proposal?.id,
      body: legacyActivity,
    });
  }

  if (env.AP_ENABLE_FEP_MARKETPLACE) {
    const marketplaceActivity = serializeMarketplaceActivity(listing, type);
    if (marketplaceActivity) {
      await enqueueActivityDelivery({
        id: marketplaceActivity.id,
        type: marketplaceActivity.type,
        listingId: listing.id,
        projectionType: "MARKETPLACE_CANONICAL",
        proposalId: listing.proposal?.id,
        body: marketplaceActivity,
      });
    }
  }
}

async function getListingWithRelations(id: string) {
  return prisma.listing.findUnique({
    where: { id },
    include: listingInclude,
  });
}

export async function getListingById(id: string) {
  const listing = await getListingWithRelations(id);

  if (!listing) {
    return null;
  }

  return listingToApi(listing);
}

export async function getListingRecordById(id: string) {
  return getListingWithRelations(id);
}

export async function listPublicListings(params: { cursor: string | null; limit: number }) {
  const cursor = decodeCursor(params.cursor);
  const limit = Math.min(Math.max(params.limit, 1), 30);

  const listings = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      ...(cursor
        ? {
            OR: [
              {
                createdAt: {
                  lt: new Date(cursor.createdAt),
                },
              },
              {
                createdAt: new Date(cursor.createdAt),
                id: {
                  lt: cursor.id,
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: listingInclude,
    take: limit + 1,
  });

  const hasMore = listings.length > limit;
  const page = hasMore ? listings.slice(0, limit) : listings;
  const nextCursor = hasMore
    ? encodeCursor({
        createdAt: page[page.length - 1].createdAt.toISOString(),
        id: page[page.length - 1].id,
      })
    : null;

  return {
    items: page.map(listingToApi),
    nextCursor,
  };
}

type ListingInput = {
  title: string;
  description: string;
  priceAmount?: number | null;
  priceCurrency?: string | null;
  location?: string | null;
  category?: string | null;
  imageKeys?: string[];
  proposalPurpose?: "offer" | "request";
  availableQuantity?: number | null;
  minimumQuantity?: number | null;
  unitCode?: string | null;
  resourceConformsTo?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
};

export async function createListing(ownerId: string, input: ListingInput) {
  const listing = await prisma.listing.create({
    data: {
      ownerId,
      title: input.title,
      description: input.description,
      priceAmount: toPrice(input.priceAmount),
      priceCurrency: input.priceCurrency ?? null,
      location: input.location ?? null,
      category: input.category ?? null,
      proposalPurpose: toProposalPurpose(input.proposalPurpose),
      availableQuantity: toQuantity(input.availableQuantity),
      minimumQuantity: toQuantity(input.minimumQuantity),
      unitCode: input.unitCode ?? null,
      resourceConformsTo: input.resourceConformsTo ?? null,
      validFrom: parseOptionalDate(input.validFrom),
      validUntil: parseOptionalDate(input.validUntil),
      canonicalUrl: `pending://${crypto.randomUUID()}`,
      activityPubObjectId: `pending://${crypto.randomUUID()}`,
      images: {
        create:
          input.imageKeys?.map((key, position) => ({
            key,
            url: getPublicObjectUrl(key),
            contentType: "image/*",
            sizeBytes: 0,
            position,
          })) ?? [],
      },
    },
    include: listingInclude,
  });

  const canonicalUrl = listingCanonicalUrl(listing.id);
  const activityPubObjectId = listingObjectId(listing.id);

  const updated = await prisma.listing.update({
    where: { id: listing.id },
    data: {
      canonicalUrl,
      activityPubObjectId,
    },
    include: listingInclude,
  });

  await syncMarketplaceProposalForListing(updated);
  const listingWithProposal = await getListingWithRelations(updated.id);
  if (!listingWithProposal) {
    throw new Error("Listing disappeared after creation");
  }

  await publishListingActivities(listingWithProposal, "Create");

  return listingToApi(listingWithProposal);
}

export async function updateListing(
  listingId: string,
  ownerId: string,
  input: Partial<ListingInput> & { status?: "ACTIVE" | "SOLD" | "REMOVED" },
) {
  const current = await getListingWithRelations(listingId);

  if (!current || current.ownerId !== ownerId) {
    return null;
  }

  const updated = await prisma.listing.update({
    where: { id: listingId },
    data: {
      title: input.title ?? current.title,
      description: input.description ?? current.description,
      priceAmount: input.priceAmount !== undefined ? toPrice(input.priceAmount) : current.priceAmount,
      priceCurrency: input.priceCurrency !== undefined ? input.priceCurrency : current.priceCurrency,
      location: input.location !== undefined ? input.location : current.location,
      category: input.category !== undefined ? input.category : current.category,
      proposalPurpose:
        input.proposalPurpose !== undefined ? toProposalPurpose(input.proposalPurpose) : current.proposalPurpose,
      availableQuantity:
        input.availableQuantity !== undefined ? toQuantity(input.availableQuantity) : current.availableQuantity,
      minimumQuantity:
        input.minimumQuantity !== undefined ? toQuantity(input.minimumQuantity) : current.minimumQuantity,
      unitCode: input.unitCode !== undefined ? input.unitCode : current.unitCode,
      resourceConformsTo:
        input.resourceConformsTo !== undefined ? input.resourceConformsTo : current.resourceConformsTo,
      validFrom: input.validFrom !== undefined ? parseOptionalDate(input.validFrom) : current.validFrom,
      validUntil: input.validUntil !== undefined ? parseOptionalDate(input.validUntil) : current.validUntil,
      status: input.status ?? current.status,
      images:
        input.imageKeys && input.imageKeys.length > 0
          ? {
              deleteMany: {},
              create: input.imageKeys.map((key, position) => ({
                key,
                url: getPublicObjectUrl(key),
                contentType: "image/*",
                sizeBytes: 0,
                position,
              })),
            }
          : undefined,
    },
    include: listingInclude,
  });

  await syncMarketplaceProposalForListing(updated);
  const listingWithProposal = await getListingWithRelations(updated.id);
  if (!listingWithProposal) {
    throw new Error("Listing not found after update");
  }

  const activityType = listingWithProposal.status === "REMOVED" ? "Delete" : "Update";
  await publishListingActivities(listingWithProposal, activityType);

  return listingToApi(listingWithProposal);
}

export async function deleteListing(listingId: string, ownerId: string) {
  const current = await getListingWithRelations(listingId);

  if (!current || current.ownerId !== ownerId) {
    return null;
  }

  const updated = await prisma.listing.update({
    where: { id: listingId },
    data: { status: "REMOVED" },
    include: listingInclude,
  });

  await syncMarketplaceProposalForListing(updated);
  const listingWithProposal = await getListingWithRelations(updated.id);
  if (!listingWithProposal) {
    throw new Error("Listing not found after delete");
  }

  await publishListingActivities(listingWithProposal, "Delete");

  return listingToApi(listingWithProposal);
}
