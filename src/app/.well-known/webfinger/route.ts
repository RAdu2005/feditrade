import { env } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
import { webfingerResource, webfingerResponse } from "@/lib/activitypub";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const resource = url.searchParams.get("resource");
  const expected = webfingerResource();
  const legacyExpected = `acct:${env.AP_LISTINGS_ACTOR}@${env.AP_INSTANCE_DOMAIN.replace(/^https?:\/\//, "")}`;

  if (resource !== expected && resource !== legacyExpected) {
    return jsonError("Resource not found", 404);
  }

  return jsonOk(webfingerResponse(), {
    headers: {
      "content-type": "application/jrd+json",
    },
  });
}
