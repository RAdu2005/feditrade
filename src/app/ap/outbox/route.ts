import { jsonOk } from "@/lib/http";
import { listingsActorId } from "@/lib/activitypub";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = 20;

  const [totalItems, activities] = await Promise.all([
    prisma.outboxActivity.count(),
    prisma.outboxActivity.findMany({
      orderBy: {
        publishedAt: "desc",
      },
      take: pageSize,
      skip: Math.max(0, page - 1) * pageSize,
    }),
  ]);

  const response = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${new URL(request.url).origin}/ap/outbox?page=${page}`,
    type: "OrderedCollectionPage",
    partOf: `${new URL(request.url).origin}/ap/outbox`,
    totalItems,
    orderedItems: activities.map((item) => item.activityJson),
    attributedTo: listingsActorId(),
  };

  return jsonOk(response, {
    headers: {
      "content-type": "application/activity+json",
    },
  });
}
