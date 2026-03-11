import { baseUrl, listingsActorId, signFederatedRequest } from "@/lib/activitypub";
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
      accept: "application/activity+json, application/ld+json",
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
  const followToAccept = buildFollowObjectForAccept(params.followActivity);

  const acceptActivity = {
    "@context": ["https://www.w3.org/ns/activitystreams"],
    id: `${baseUrl()}/ap/activities/${crypto.randomUUID()}`,
    type: "Accept",
    actor: listingsActorId(),
    to: [params.actor],
    object: followToAccept,
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

    failures.push(`${target} -> ${response.status}`);
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
  if (!params.activity.id || !params.activity.actor || !params.activity.type) {
    return null;
  }

  return prisma.inboxActivityLog.upsert({
    where: {
      activityId: params.activity.id,
    },
    update: {
      signatureValid: params.signatureValid,
      processed: params.processed ?? false,
      processingError: params.processingError ?? null,
      rawActivity: params.activity as object,
    },
    create: {
      activityId: params.activity.id,
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
    const undoActor = extractUndoFollowActor(activity.object) ?? activity.actor;
    if (undoActor) {
      await prisma.federationFollower.deleteMany({
        where: {
          actor: undoActor,
        },
      });
      return;
    }
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

function buildFollowObjectForAccept(followActivity: ActivityPayload): Record<string, unknown> {
  const hasValidFollowShape =
    followActivity.type === "Follow" &&
    typeof followActivity.actor === "string" &&
    isFollowTargetingListingsActor(followActivity.object);

  if (hasValidFollowShape) {
    return {
      ...(followActivity as Record<string, unknown>),
      object: normalizeObjectId(followActivity.object) ?? listingsActorId(),
    };
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

function extractUndoFollowActor(object: unknown) {
  if (!object || typeof object !== "object") {
    return null;
  }

  const undoObject = object as { type?: unknown; actor?: unknown };
  if (undoObject.type !== "Follow") {
    return null;
  }

  return typeof undoObject.actor === "string" ? undoObject.actor : null;
}
