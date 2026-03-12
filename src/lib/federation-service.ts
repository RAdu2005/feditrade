import { createHash } from "node:crypto";
import {
  ACTOR_FETCH_ACCEPT_HEADER,
  baseUrl,
  createActivity,
  listingsActorId,
  signFederatedRequest,
} from "@/lib/activitypub";
import { env } from "@/lib/env";
import { childLogger } from "@/lib/logger";
import { recordInboundMarketplaceOffer } from "@/lib/marketplace-offer-service";
import { prisma } from "@/lib/prisma";

type ActivityPayload = {
  id?: string;
  type?: string;
  actor?: string;
  object?: unknown;
  result?: unknown;
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

async function sendSignedActivity(params: {
  activity: Record<string, unknown>;
  targets: string[];
}) {
  const body = JSON.stringify(params.activity);
  const uniqueTargets = [...new Set(params.targets.filter(Boolean))];

  for (const target of uniqueTargets) {
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

    if (!response.ok) {
      const responseText = (await response.text()).slice(0, 300);
      throw new Error(
        `Failed to send activity to ${target}: ${response.status}${responseText ? ` (${responseText})` : ""}`,
      );
    }
  }
}

async function sendAcceptFollow(params: {
  actor: string;
  inbox: string;
  sharedInbox?: string | null;
  followActivity: ActivityPayload;
}) {
  const acceptObject = buildFollowObjectForAccept(params.followActivity);

  const acceptActivity = createActivity({
    id: crypto.randomUUID(),
    type: "Accept",
    to: [params.actor],
    cc: [],
    object: acceptObject,
  });

  await sendSignedActivity({
    activity: acceptActivity,
    targets: [params.inbox, params.sharedInbox ?? ""],
  });

  logger.info(
    {
      followActor: params.actor,
      followId: params.followActivity.id,
    },
    "Sent Accept for Follow",
  );
}

async function sendRejectOffer(params: {
  actor: string;
  inbox: string;
  offerActivityId: string;
  reason: string;
}) {
  const rejectActivity = createActivity({
    id: crypto.randomUUID(),
    type: "Reject",
    to: [params.actor],
    cc: [],
    object: {
      id: params.offerActivityId,
      type: "Offer",
    },
    result: {
      reason: params.reason,
    },
  });

  await sendSignedActivity({
    activity: rejectActivity,
    targets: [params.inbox],
  });
}

function isAdminActor(actor: string) {
  return env.ADMIN_ACTOR_URIS.includes(actor);
}

function normalizeUri(value: string) {
  return value.replace(/\/+$/, "");
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

function readObjectFieldAsId(source: unknown, field: string) {
  if (!source || typeof source !== "object") {
    return null;
  }

  return normalizeObjectId((source as Record<string, unknown>)[field]);
}

function extractOfferTargetProposalId(value: unknown) {
  const direct = normalizeObjectId(value);
  if (direct?.includes("/ap/proposals/")) {
    return direct;
  }

  const fromObject =
    readObjectFieldAsId(value, "proposal") ??
    readObjectFieldAsId(value, "object") ??
    readObjectFieldAsId(value, "basedOn") ??
    readObjectFieldAsId(value, "target") ??
    readObjectFieldAsId(value, "inReplyTo");

  if (fromObject?.includes("/ap/proposals/")) {
    return fromObject;
  }

  return null;
}

function extractAgreementTargetId(value: unknown) {
  const direct = normalizeObjectId(value);
  if (direct?.includes("/ap/agreements/")) {
    return direct;
  }

  const nested =
    readObjectFieldAsId(value, "agreement") ??
    readObjectFieldAsId(value, "about") ??
    readObjectFieldAsId(value, "object") ??
    readObjectFieldAsId(value, "id");

  if (nested?.includes("/ap/agreements/")) {
    return nested;
  }

  return null;
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

function isFollowTargetingListingsActor(object: unknown) {
  const targetObjectId = normalizeObjectId(object);
  return targetObjectId === normalizeUri(listingsActorId());
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

function isMarketplaceWorkflow(activity: ActivityPayload) {
  if (!activity.type) {
    return false;
  }

  const marketplaceTypes = new Set(["Offer", "Accept", "Reject"]);
  if (marketplaceTypes.has(activity.type)) {
    return true;
  }

  if (activity.type === "Create") {
    const objectType =
      typeof activity.object === "object" && activity.object
        ? (activity.object as { type?: unknown }).type
        : null;
    return objectType === "Document";
  }

  return false;
}

function resolveTargetObjectId(activity: ActivityPayload) {
  return (
    normalizeObjectId(activity.object) ??
    extractOfferTargetProposalId(activity.object) ??
    extractAgreementTargetId(activity.object) ??
    extractAgreementTargetId(activity.result)
  );
}

function toAgreementRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
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
  const workflowType = isMarketplaceWorkflow(params.activity) ? "MARKETPLACE" : "SOCIAL";

  return prisma.inboxActivityLog.upsert({
    where: {
      activityId: persistedActivityId,
    },
    update: {
      signatureValid: params.signatureValid,
      processed: params.processed ?? false,
      processingError: params.processingError ?? null,
      rawActivity: params.activity as object,
      workflowType,
      targetObjectId: resolveTargetObjectId(params.activity),
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
      workflowType,
      targetObjectId: resolveTargetObjectId(params.activity),
    },
  });
}

async function processInboundOffer(activity: ActivityPayload) {
  if (!activity.actor) {
    return;
  }

  const proposalId = extractOfferTargetProposalId(activity.object);
  if (!proposalId) {
    return;
  }

  const agreementJson = toAgreementRecord(activity.object);
  if (!agreementJson) {
    return;
  }

  const remoteInboxes = await fetchActorInbox(activity.actor);
  const activityId = resolvePersistedActivityId(activity);

  const offer = await recordInboundMarketplaceOffer({
    activityId,
    remoteActorId: activity.actor,
    remoteInbox: remoteInboxes.inbox,
    proposalActivityPubId: proposalId,
    agreementJson,
  });

  if (!offer) {
    await sendRejectOffer({
      actor: activity.actor,
      inbox: remoteInboxes.inbox,
      offerActivityId: activityId,
      reason: "Unknown proposal target",
    });
    return;
  }

  if (offer.proposal.status !== "PUBLISHED") {
    await sendRejectOffer({
      actor: activity.actor,
      inbox: remoteInboxes.inbox,
      offerActivityId: activityId,
      reason: "Proposal is not open for new agreements",
    });

    await prisma.marketplaceOffer.update({
      where: {
        id: offer.id,
      },
      data: {
        status: "REJECTED",
        respondedAt: new Date(),
      },
    });
  }
}

async function processInboundAccept(activity: ActivityPayload) {
  const agreementTarget = extractAgreementTargetId(activity.result) ?? extractAgreementTargetId(activity.object);
  if (!agreementTarget) {
    return;
  }

  await prisma.marketplaceAgreement.updateMany({
    where: {
      activityPubId: agreementTarget,
    },
    data: {
      status: "ACCEPTED",
      acceptedAt: new Date(),
    },
  });
}

async function processInboundReject(activity: ActivityPayload) {
  const agreementTarget = extractAgreementTargetId(activity.object) ?? extractAgreementTargetId(activity.result);
  if (!agreementTarget) {
    return;
  }

  await prisma.marketplaceAgreement.updateMany({
    where: {
      activityPubId: agreementTarget,
    },
    data: {
      status: "CANCELLED",
    },
  });
}

async function processInboundConfirmation(activity: ActivityPayload) {
  if (activity.type !== "Create") {
    return;
  }

  if (!activity.object || typeof activity.object !== "object") {
    return;
  }

  const object = activity.object as { type?: unknown; about?: unknown; id?: unknown };
  if (object.type !== "Document") {
    return;
  }

  const agreementId = normalizeObjectId(object.about);
  if (!agreementId || !agreementId.includes("/ap/agreements/")) {
    return;
  }

  const existingAgreement = await prisma.marketplaceAgreement.findUnique({
    where: {
      activityPubId: agreementId,
    },
  });

  if (!existingAgreement) {
    return;
  }

  const confirmationActivityId =
    normalizeObjectId(object.id) ?? activity.id ?? `${existingAgreement.activityPubId}#confirmation-${crypto.randomUUID()}`;

  await prisma.marketplaceAgreement.update({
    where: {
      id: existingAgreement.id,
    },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  await prisma.marketplaceConfirmation.upsert({
    where: {
      activityId: confirmationActivityId,
    },
    update: {
      documentJson: activity.object as object,
      publishedAt: new Date(),
    },
    create: {
      agreementId: existingAgreement.id,
      activityId: confirmationActivityId,
      documentJson: activity.object as object,
    },
  });
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
    return;
  }

  if (activity.type === "Offer") {
    await processInboundOffer(activity);
    return;
  }

  if (activity.type === "Accept") {
    await processInboundAccept(activity);
    return;
  }

  if (activity.type === "Reject") {
    await processInboundReject(activity);
    return;
  }

  await processInboundConfirmation(activity);
}
