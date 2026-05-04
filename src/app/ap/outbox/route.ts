import { jsonOk } from "@/lib/http";
import { baseUrl, createActivity, createListingNote, listingsActorId } from "@/lib/activitypub";
import { prisma } from "@/lib/prisma";

const projectionValues = new Set([
  "LEGACY_NOTE",
  "MARKETPLACE_CANONICAL",
  "MARKETPLACE_RESPONSE",
  "MARKETPLACE_CONFIRMATION",
] as const);

function isProjectionValue(value: string): value is
  | "LEGACY_NOTE"
  | "MARKETPLACE_CANONICAL"
  | "MARKETPLACE_RESPONSE"
  | "MARKETPLACE_CONFIRMATION" {
  return projectionValues.has(value as never);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pageParam = url.searchParams.get("page");
  const projectionParam = url.searchParams.get("projection");
  const projectionFilter = projectionParam && isProjectionValue(projectionParam) ? projectionParam : null;
  const page = Math.max(1, Number(pageParam ?? "1"));
  const pageSize = 20;
  const canonicalBaseUrl = baseUrl();

  if (!projectionFilter) {
    const totalItems = await prisma.listing.count({
      where: {
        status: "ACTIVE",
      },
    });

    if (!pageParam) {
      const firstPageListings = await prisma.listing.findMany({
        where: {
          status: "ACTIVE",
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
          proposal: {
            select: {
              activityPubId: true,
            },
          },
        },
        take: pageSize,
      });

      const orderedItems = firstPageListings.map((listing) =>
        createActivity({
          id: `legacy-profile-${listing.id}`,
          type: "Create",
          object: createListingNote({
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
          }),
        }),
      );

      const hasNextPage = totalItems > pageSize;
      const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));

      const response = {
        "@context": "https://www.w3.org/ns/activitystreams",
        id: `${canonicalBaseUrl}/ap/outbox`,
        type: "OrderedCollection",
        totalItems,
        first: {
          id: `${canonicalBaseUrl}/ap/outbox?page=1`,
          type: "OrderedCollectionPage",
          partOf: `${canonicalBaseUrl}/ap/outbox`,
          attributedTo: listingsActorId(),
          orderedItems,
          ...(hasNextPage
            ? {
                next: `${canonicalBaseUrl}/ap/outbox?page=2`,
              }
            : {}),
        },
        last: `${canonicalBaseUrl}/ap/outbox?page=${pageCount}`,
      };

      return jsonOk(response, {
        headers: {
          "content-type": "application/activity+json",
        },
      });
    }

    const listings = await prisma.listing.findMany({
      where: {
        status: "ACTIVE",
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
        proposal: {
          select: {
            activityPubId: true,
          },
        },
      },
      take: pageSize,
      skip: Math.max(0, page - 1) * pageSize,
    });

    const orderedItems = listings.map((listing) =>
      createActivity({
        id: `legacy-profile-${listing.id}`,
        type: "Create",
        object: createListingNote({
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
        }),
      }),
    );

    const hasNextPage = page * pageSize < totalItems;
    const response = {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: `${canonicalBaseUrl}/ap/outbox?page=${page}`,
      type: "OrderedCollectionPage",
      partOf: `${canonicalBaseUrl}/ap/outbox`,
      totalItems,
      orderedItems,
      attributedTo: listingsActorId(),
      ...(hasNextPage
        ? {
            next: `${canonicalBaseUrl}/ap/outbox?page=${page + 1}`,
          }
        : {}),
    };

    return jsonOk(response, {
      headers: {
        "content-type": "application/activity+json",
      },
    });
  }

  const where = { projectionType: projectionFilter };
  const totalItems = await prisma.outboxActivity.count({ where });

  if (!pageParam) {
    const firstPageItems = await prisma.outboxActivity.findMany({
      where,
      orderBy: {
        publishedAt: "desc",
      },
      take: pageSize,
    });
    const hasNextPage = totalItems > pageSize;
    const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));

    const response = {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: `${canonicalBaseUrl}/ap/outbox${projectionFilter ? `?projection=${projectionFilter}` : ""}`,
      type: "OrderedCollection",
      totalItems,
      first: {
        id: `${canonicalBaseUrl}/ap/outbox?page=1${projectionFilter ? `&projection=${projectionFilter}` : ""}`,
        type: "OrderedCollectionPage",
        partOf: `${canonicalBaseUrl}/ap/outbox${projectionFilter ? `?projection=${projectionFilter}` : ""}`,
        attributedTo: listingsActorId(),
        orderedItems: firstPageItems.map((item) => item.activityJson),
        ...(hasNextPage
          ? {
              next: `${canonicalBaseUrl}/ap/outbox?page=2${projectionFilter ? `&projection=${projectionFilter}` : ""}`,
            }
          : {}),
      },
      last: `${canonicalBaseUrl}/ap/outbox?page=${pageCount}${projectionFilter ? `&projection=${projectionFilter}` : ""}`,
    };

    return jsonOk(response, {
      headers: {
        "content-type": "application/activity+json",
      },
    });
  }

  const activities = await prisma.outboxActivity.findMany({
    where,
    orderBy: {
      publishedAt: "desc",
    },
    take: pageSize,
    skip: Math.max(0, page - 1) * pageSize,
  });

  const hasNextPage = page * pageSize < totalItems;

  const response = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${canonicalBaseUrl}/ap/outbox?page=${page}${projectionFilter ? `&projection=${projectionFilter}` : ""}`,
    type: "OrderedCollectionPage",
    partOf: `${canonicalBaseUrl}/ap/outbox${projectionFilter ? `?projection=${projectionFilter}` : ""}`,
    totalItems,
    orderedItems: activities.map((item) => item.activityJson),
    attributedTo: listingsActorId(),
    ...(hasNextPage
      ? {
          next: `${canonicalBaseUrl}/ap/outbox?page=${page + 1}${projectionFilter ? `&projection=${projectionFilter}` : ""}`,
        }
      : {}),
  };

  return jsonOk(response, {
    headers: {
      "content-type": "application/activity+json",
    },
  });
}
