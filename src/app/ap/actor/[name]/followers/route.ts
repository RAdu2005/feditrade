import { env } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { baseUrl } from "@/lib/activitypub";

type Params = {
  params: Promise<{ name: string }>;
};

export async function GET(_request: Request, context: Params) {
  const { name } = await context.params;
  if (name !== env.AP_LISTINGS_ACTOR) {
    return jsonError("Actor not found", 404);
  }

  const followers = await prisma.federationFollower.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  const origin = baseUrl();
  return jsonOk(
    {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: `${origin}/ap/actor/${name}/followers`,
      type: "OrderedCollection",
      totalItems: followers.length,
      orderedItems: followers.map((f) => f.actor),
    },
    {
      headers: {
        "content-type": "application/activity+json",
      },
    },
  );
}
