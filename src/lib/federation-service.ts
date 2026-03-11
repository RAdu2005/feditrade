import { createHash } from "node:crypto";
import {
  ACTOR_FETCH_ACCEPT_HEADER,
  baseUrl,
  listingsActorId,
  signFederatedRequest,
} from "@/lib/activitypub";
import { env } from "@/lib/env";
import { childLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

type ActivityPayload = {
  id?: string;
  type?: string;
  actor?: string;
  object?: unknown;
  [key: string]: unknown;
};

const logger = childLogger({ module: "federation-service" });

async function fetchActorInbox(actorUrl: string) {
  const response = await fetch(actorUrl, {
    headers: {
      accept: ACTOR_FETCH_ACCEPT_HEADER,
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch actor ${actorUrl}`);
  }

  const actor = (await response.json()) as {
    inbox?: string;
    endpoints?: {
      sharedInbox?: string;
    };
  };

  if (!actor.inbox) {
    throw new Error(`Actor ${actorUrl} does not expose inbox`);
  }

  return {
    inbox: actor.inbox,
    sharedInbox: actor.endpoints?.sharedInbox,
  };
}

async function sendAcceptFollow(params: {
  actor: string;
  inbox: string;
  sharedInbox?: string | null;
  followActivity: ActivityPayload;
}) {
  const acceptObject = buildAcceptObject(params.followActivity);

  const acceptActivity = {
    "@context": ["https://www.w3.org/ns/activitystreams"],
    id: `${baseUrl()}/ap/activities/${crypto.randomUUID()}`,
    type: "Accept",
    actor: listingsActorId(),
    to: [params.actor],
    object: acceptObject,
    published: new Date().toISOString(),
  };

  const body = JSON.stringify(acceptActivity);

  const targets = [...new Set([params.inbox, params.sharedInbox].filter(Boolean) as string[])];
  const successes: string[] = [];
  const failures: string[] = [];

  for (const target of targets) {
    const targetUrl = new URL(target);
    const signedHeaders = signFederatedRequest({
      method: "post",
      url: targetUrl,
      body,
    });

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        ...signedHeaders,
        accept: "application/activity+json",
      },
      body,
    });

    if (response.ok) {
      successes.push(`${target} -> ${response.status}`);
      continue;
    }

    const responseText = (await response.text()).slice(0, 300);
    failures.push(
      `${target} -> ${response.status}${responseText ? ` (${responseText.replace(/\s+/g, " ")})` : ""}`,
    );
  }

  if (successes.length > 0) {
    logger.info(
      {
        followActor: params.actor,
        followId: params.followActivity.id,
        successTargets: successes,
        failedTargets: failures,
      },
      "Sent Accept for Follow",
    );
    return;
  }

  if (failures.length > 0) {
    throw new Error(`Failed to send Accept for Follow: ${failures.join("; ")}`);
  }
}

export async function persistInboundActivity(params: {
  activity: ActivityPayload;
  signatureValid: boolean;
  processingError?: string;
  processed?: boolean;
}) {
  if (!params.activity.actor || !params.activity.type) {
    return null;
  }

  const persistedActivityId = resolvePersistedActivityId(params.activity);

  return prisma.inboxActivityLog.upsert({
    where: {
      activityId: persistedActivityId,
    },
    update: {
      signatureValid: params.signatureValid,
      processed: params.processed ?? false,
      processingError: params.processingError ?? null,
      rawActivity: params.activity as object,
      receivedAt: new Date(),
    },
    create: {
      activityId: persistedActivityId,
      actor: params.activity.actor,
      activityType: params.activity.type,
      signatureValid: params.signatureValid,
      processed: params.processed ?? false,
      processingError: params.processingError ?? null,
      rawActivity: params.activity as object,
    },
  });
}

function isAdminActor(actor: string) {
  return env.ADMIN_ACTOR_URIS.includes(actor);
}

export async function processInboundActivity(activity: ActivityPayload) {
  if (!activity.actor || !activity.type) {
    return;
  }

  if (activity.type === "Follow" && isFollowTargetingListingsActor(activity.object)) {
    const actor = activity.actor;
    const inboxes = await fetchActorInbox(actor);

    await prisma.federationFollower.upsert({
      where: { actor },
      update: {
        inbox: inboxes.inbox,
        sharedInbox: inboxes.sharedInbox ?? null,
      },
      create: {
        actor,
        inbox: inboxes.inbox,
        sharedInbox: inboxes.sharedInbox ?? null,
      },
    });

    await sendAcceptFollow({
      actor,
      inbox: inboxes.inbox,
      sharedInbox: inboxes.sharedInbox,
      followActivity: activity,
    });

    return;
  }

  if (activity.type === "Undo") {
    const undoFollow = extractUndoFollow(activity.object);
    if (!undoFollow) {
      return;
    }

    const followActor = undoFollow.actor ?? activity.actor;
    if (!followActor || !isFollowTargetingListingsActor(undoFollow.object)) {
      return;
    }

    await prisma.federationFollower.deleteMany({
      where: {
        actor: followActor,
      },
    });
    return;
  }

  if (
    activity.type === "Delete" &&
    isAdminActor(activity.actor) &&
    typeof activity.object === "string"
  ) {
    await prisma.listing.updateMany({
      where: {
        activityPubObjectId: activity.object,
      },
      data: {
        status: "REMOVED",
      },
    });
  }
}

function normalizeObjectId(value: unknown) {
  if (typeof value === "string") {
    return normalizeUri(value);
  }

  if (value && typeof value === "object") {
    const objectId = (value as { id?: unknown }).id;
    if (typeof objectId === "string") {
      return normalizeUri(objectId);
    }
  }

  return null;
}

function normalizeUri(value: string) {
  return value.replace(/\/+$/, "");
}

function buildAcceptObject(followActivity: ActivityPayload): Record<string, unknown> {
  return buildFollowObjectForAccept(followActivity);
}

function buildFollowObjectForAccept(followActivity: ActivityPayload): Record<string, unknown> {
  const hasValidFollowShape =
    followActivity.type === "Follow" &&
    typeof followActivity.actor === "string" &&
    isFollowTargetingListingsActor(followActivity.object);

  if (hasValidFollowShape) {
    return { ...(followActivity as Record<string, unknown>) };
  }

  return {
    id: followActivity.id ?? `${baseUrl()}/ap/follows/${crypto.randomUUID()}`,
    type: "Follow",
    actor: followActivity.actor,
    object: normalizeObjectId(followActivity.object) ?? listingsActorId(),
  };
}

function isFollowTargetingListingsActor(object: unknown) {
  const targetObjectId = normalizeObjectId(object);
  return targetObjectId === normalizeUri(listingsActorId());
}

function extractUndoFollow(object: unknown) {
  if (!object || typeof object !== "object") {
    return null;
  }

  const undoObject = object as { type?: unknown; actor?: unknown; object?: unknown };
  if (undoObject.type !== "Follow") {
    return null;
  }

  return {
    actor: typeof undoObject.actor === "string" ? undoObject.actor : null,
    object: undoObject.object,
  };
}

function resolvePersistedActivityId(activity: ActivityPayload) {
  if (typeof activity.id === "string" && activity.id.trim().length > 0) {
    return activity.id;
  }

  const fallbackSource = JSON.stringify({
    actor: activity.actor,
    type: activity.type,
    object: activity.object ?? null,
  });
  const digest = createHash("sha256").update(fallbackSource).digest("hex");
  return `urn:feditrade:inbox:${digest}`;
}
