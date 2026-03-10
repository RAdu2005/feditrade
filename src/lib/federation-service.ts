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
  const followToAccept: Record<string, unknown> =
    params.followActivity.id && params.followActivity.type === "Follow"
      ? { ...params.followActivity }
      : {
          id: params.followActivity.id ?? `${baseUrl()}/ap/follows/${crypto.randomUUID()}`,
          type: "Follow",
          actor: params.followActivity.actor,
          object: listingsActorId(),
        };

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
  const errors: string[] = [];

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
      logger.info(
        {
          followActor: params.actor,
          targetInbox: target,
          followId: params.followActivity.id,
        },
        "Sent Accept for Follow",
      );
      return;
    }

    errors.push(`${target} -> ${response.status}`);
  }

  if (errors.length > 0) {
    throw new Error(`Failed to send Accept for Follow: ${errors.join("; ")}`);
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

  if (activity.type === "Follow" && activity.object === listingsActorId()) {
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

  if (activity.type === "Undo" && typeof activity.object === "object" && activity.object) {
    const undoObject = activity.object as { type?: string; actor?: string; object?: string };
    if (undoObject.type === "Follow" && undoObject.actor) {
      await prisma.federationFollower.deleteMany({
        where: {
          actor: undoObject.actor,
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
