import { jsonError, jsonOk } from "@/lib/http";
import { childLogger } from "@/lib/logger";
import { processInboundActivity, persistInboundActivity } from "@/lib/federation-service";
import { normalizeActorReference, verifyIncomingSignature } from "@/lib/activitypub";

type InboundActivity = {
  id?: string;
  type?: string;
  actor?: unknown;
  object?: unknown;
  [key: string]: unknown;
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

  const actorId = normalizeActorReference(activity.actor);
  if (!actorId || !activity.type) {
    return jsonError("Missing or invalid actor/type", 400);
  }

  const normalizedActivity: InboundActivity & { actor: string; type: string } = {
    ...activity,
    actor: actorId,
    type: activity.type,
  };

  let signatureValid = false;
  let signatureError: string | undefined;
  try {
    signatureValid = await verifyIncomingSignature({
      request,
      body,
      actorUrl: actorId,
    });
  } catch (error) {
    signatureValid = false;
    signatureError = error instanceof Error ? error.message : "Signature verification error";
  }

  logger.info(
    {
      activityId: normalizedActivity.id ?? null,
      actor: normalizedActivity.actor,
      activityType: normalizedActivity.type,
      signatureValid,
      signatureError: signatureError ?? null,
    },
    "Received inbox activity",
  );

  if (!signatureValid) {
    await persistInboundActivity({
      activity: normalizedActivity,
      signatureValid: false,
      processed: false,
      processingError: signatureError ?? "Invalid HTTP signature",
    });
    return jsonError("Signature verification failed", 401);
  }

  try {
    await processInboundActivity(normalizedActivity);
    await persistInboundActivity({
      activity: normalizedActivity,
      signatureValid: true,
      processed: true,
    });
    logger.info(
      {
        activityId: normalizedActivity.id ?? null,
        actor: normalizedActivity.actor,
        activityType: normalizedActivity.type,
      },
      "Persisted inbox activity",
    );
  } catch (error) {
    logger.error(
      { err: error, activityId: normalizedActivity.id },
      "Failed to process inbound activity",
    );
    await persistInboundActivity({
      activity: normalizedActivity,
      signatureValid: true,
      processed: false,
      processingError: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return jsonOk({ accepted: true }, { status: 202 });
}
