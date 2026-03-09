import { env } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
import { listingsActorDocument } from "@/lib/activitypub";

type Params = {
  params: Promise<{ name: string }>;
};

export async function GET(_: Request, context: Params) {
  const { name } = await context.params;
  if (name !== env.AP_LISTINGS_ACTOR) {
    return jsonError("Actor not found", 404);
  }

  return jsonOk(listingsActorDocument(), {
    headers: {
      "content-type": "application/activity+json",
    },
  });
}
