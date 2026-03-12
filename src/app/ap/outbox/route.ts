import { jsonOk } from "@/lib/http";
import { baseUrl, listingsActorId } from "@/lib/activitypub";
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

  const where = projectionFilter ? { projectionType: projectionFilter } : undefined;
  const totalItems = await prisma.outboxActivity.count({ where });
  const canonicalBaseUrl = baseUrl();

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
