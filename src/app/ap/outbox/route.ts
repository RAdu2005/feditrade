import { jsonOk } from "@/lib/http";
import { baseUrl, listingsActorId } from "@/lib/activitypub";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pageParam = url.searchParams.get("page");
  const page = Math.max(1, Number(pageParam ?? "1"));
  const pageSize = 20;

  const totalItems = await prisma.outboxActivity.count();
  const canonicalBaseUrl = baseUrl();

  if (!pageParam) {
    const firstPageItems = await prisma.outboxActivity.findMany({
      orderBy: {
        publishedAt: "desc",
      },
      take: pageSize,
    });
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
        orderedItems: firstPageItems.map((item) => item.activityJson),
        ...(hasNextPage ? { next: `${canonicalBaseUrl}/ap/outbox?page=2` } : {}),
      },
      last: `${canonicalBaseUrl}/ap/outbox?page=${pageCount}`,
    };

    return jsonOk(response, {
      headers: {
        "content-type": "application/activity+json",
      },
    });
  }

  const activities = await prisma.outboxActivity.findMany({
    orderBy: {
      publishedAt: "desc",
    },
    take: pageSize,
    skip: Math.max(0, page - 1) * pageSize,
  });

  const hasNextPage = page * pageSize < totalItems;

  const response = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${canonicalBaseUrl}/ap/outbox?page=${page}`,
    type: "OrderedCollectionPage",
    partOf: `${canonicalBaseUrl}/ap/outbox`,
    totalItems,
    orderedItems: activities.map((item) => item.activityJson),
    attributedTo: listingsActorId(),
    ...(hasNextPage ? { next: `${canonicalBaseUrl}/ap/outbox?page=${page + 1}` } : {}),
  };

  return jsonOk(response, {
    headers: {
      "content-type": "application/activity+json",
    },
  });
}
