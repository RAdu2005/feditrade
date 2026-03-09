import { jsonError, jsonOk } from "@/lib/http";
import { childLogger } from "@/lib/logger";
import { processInboundActivity, persistInboundActivity } from "@/lib/federation-service";
import { verifyIncomingSignature } from "@/lib/activitypub";

type InboundActivity = {
  id?: string;
  type?: string;
  actor?: string;
  object?: unknown;
};

export async function POST(request: Request) {
  const logger = childLogger({ route: "POST /ap/inbox" });
  const body = await request.text();

  let activity: InboundActivity;
  try {
    activity = JSON.parse(body) as InboundActivity;
  } catch {
    return jsonError("Invalid JSON payload", 400);
  }

  if (!activity.actor || !activity.type) {
    return jsonError("Missing actor or type", 400);
  }

  const signatureValid = await verifyIncomingSignature({
    request,
    body,
    actorUrl: activity.actor,
  });

  if (!signatureValid) {
    await persistInboundActivity({
      activity,
      signatureValid: false,
      processed: false,
      processingError: "Invalid HTTP signature",
    });
    return jsonError("Signature verification failed", 401);
  }

  try {
    await processInboundActivity(activity);
    await persistInboundActivity({
      activity,
      signatureValid: true,
      processed: true,
    });
  } catch (error) {
    logger.error({ err: error, activityId: activity.id }, "Failed to process inbound activity");
    await persistInboundActivity({
      activity,
      signatureValid: true,
      processed: false,
      processingError: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return jsonOk({ accepted: true }, { status: 202 });
}
