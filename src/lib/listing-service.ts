import { Prisma } from "@prisma/client";
import { createActivity, createListingNote } from "@/lib/activitypub";
import { enqueueActivityDelivery } from "@/lib/delivery-queue";
import { decodeCursor, encodeCursor } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { getPublicObjectUrl } from "@/lib/s3";
import { listingCanonicalUrl, listingObjectId } from "@/lib/activitypub";

const listingInclude = {
  images: {
    orderBy: {
      position: "asc",
    },
  },
  owner: {
    select: {
      id: true,
      mastodonActorUri: true,
      mastodonUsername: true,
      mastodonDomain: true,
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
    status: listing.status,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
    canonicalUrl: listing.canonicalUrl,
    owner: {
      actorUri: listing.owner.mastodonActorUri,
      username: listing.owner.mastodonUsername,
      domain: listing.owner.mastodonDomain,
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

function serializeActivity(listing: ListingWithRelations, type: "Create" | "Update" | "Delete") {
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
    ownerActorUri: listing.owner.mastodonActorUri,
    priceAmount: listing.priceAmount?.toString(),
    priceCurrency: listing.priceCurrency,
    category: listing.category,
    location: listing.location,
    imageUrls: listing.images.map((image) => image.url),
    updatedAt: listing.updatedAt,
  });

  return createActivity({
    type,
    id: crypto.randomUUID(),
    object: note,
  });
}

export async function getListingById(id: string) {
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: listingInclude,
  });

  if (!listing) {
    return null;
  }

  return listingToApi(listing);
}

export async function getListingRecordById(id: string) {
  return prisma.listing.findUnique({
    where: { id },
    include: listingInclude,
  });
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

  const activity = serializeActivity(updated, "Create");
  await enqueueActivityDelivery({
    id: activity.id,
    type: activity.type,
    listingId: updated.id,
    body: activity,
  });

  return listingToApi(updated);
}

export async function updateListing(listingId: string, ownerId: string, input: Partial<ListingInput> & { status?: "ACTIVE" | "SOLD" | "REMOVED" }) {
  const current = await prisma.listing.findUnique({
    where: { id: listingId },
    include: listingInclude,
  });

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

  const activityType = updated.status === "REMOVED" ? "Delete" : "Update";
  const activity = serializeActivity(updated, activityType);
  await enqueueActivityDelivery({
    id: activity.id,
    type: activity.type,
    listingId: updated.id,
    body: activity,
  });

  return listingToApi(updated);
}

export async function deleteListing(listingId: string, ownerId: string) {
  const current = await prisma.listing.findUnique({
    where: { id: listingId },
    include: listingInclude,
  });

  if (!current || current.ownerId !== ownerId) {
    return null;
  }

  const updated = await prisma.listing.update({
    where: { id: listingId },
    data: { status: "REMOVED" },
    include: listingInclude,
  });

  const activity = serializeActivity(updated, "Delete");
  await enqueueActivityDelivery({
    id: activity.id,
    type: activity.type,
    listingId: updated.id,
    body: activity,
  });

  return listingToApi(updated);
}
