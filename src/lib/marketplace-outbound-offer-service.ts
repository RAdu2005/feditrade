import { MarketplaceAgreementStatus, MarketplaceOutboundOfferStatus, Prisma } from "@prisma/client";
import {
  ACTOR_FETCH_ACCEPT_HEADER,
  createActivity,
  listingsActorId,
  signFederatedRequest,
} from "@/lib/activitypub";
import { prisma } from "@/lib/prisma";

type OutboundOfferInput = {
  targetProposalId: string;
  targetActorId: string;
  targetInbox?: string | null;
  note?: string | null;
  quantity?: number | null;
  unitCode?: string | null;
  amount?: number | null;
  currency?: string | null;
};

type InboundActivityPayload = {
  id?: string;
  type?: string;
  actor?: string;
  object?: unknown;
  result?: unknown;
  [key: string]: unknown;
};

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function normalizeObjectId(value: unknown) {
  if (typeof value === "string") {
    return value.replace(/\/+$/, "");
  }

  if (value && typeof value === "object") {
    const objectId = (value as { id?: unknown }).id;
    if (typeof objectId === "string") {
      return objectId.replace(/\/+$/, "");
    }
  }

  return null;
}

function extractOfferActivityId(value: unknown) {
  const direct = normalizeObjectId(value);
  if (direct) {
    return direct;
  }

  if (value && typeof value === "object") {
    const nested = normalizeObjectId((value as Record<string, unknown>).object);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function extractAgreementIdFromAccept(result: unknown) {
  const objectId = normalizeObjectId(result);
  if (objectId && objectId.includes("/ap/agreements/")) {
    return objectId;
  }

  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    const basedOn = normalizeObjectId(record.basedOn);
    if (basedOn && basedOn.includes("/ap/agreements/")) {
      return basedOn;
    }
  }

  return objectId;
}

async function fetchActorInbox(actorUrl: string) {
  const response = await fetch(actorUrl, {
    headers: {
      accept: ACTOR_FETCH_ACCEPT_HEADER,
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch target actor ${actorUrl}`);
  }

  const actor = (await response.json()) as {
    inbox?: string;
    endpoints?: {
      sharedInbox?: string;
    };
  };

  if (!actor.inbox) {
    throw new Error(`Target actor ${actorUrl} does not expose inbox`);
  }

  return actor.endpoints?.sharedInbox ?? actor.inbox;
}

async function sendSignedActivity(targetInbox: string, activity: Record<string, unknown>) {
  const payload = JSON.stringify(activity);
  const targetUrl = new URL(targetInbox);
  const signedHeaders = signFederatedRequest({
    method: "post",
    url: targetUrl,
    body: payload,
  });

  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      ...signedHeaders,
      accept: "application/activity+json",
    },
    body: payload,
  });

  if (!response.ok) {
    const responseText = (await response.text()).slice(0, 300);
    throw new Error(
      `Remote inbox responded ${response.status}${responseText ? ` (${responseText.replace(/\s+/g, " ")})` : ""}`,
    );
  }
}

function agreementPayload(input: OutboundOfferInput) {
  const agreement: Record<string, unknown> = {
    type: "Agreement",
    basedOn: input.targetProposalId,
    provider: listingsActorId(),
    receiver: input.targetActorId,
  };

  if (input.note) {
    agreement.note = input.note;
  }

  if (input.quantity && input.quantity > 0) {
    agreement.resourceQuantity = {
      hasNumericalValue: input.quantity,
      ...(input.unitCode ? { hasUnit: input.unitCode.toUpperCase() } : {}),
    };
  }

  if (input.amount && input.amount > 0 && input.currency) {
    agreement.reciprocal = {
      type: "Intent",
      action: "transfer",
      resourceConformsTo: `urn:iso:std:iso:4217:${input.currency.toUpperCase()}`,
      resourceQuantity: {
        hasNumericalValue: input.amount,
        hasUnit: input.currency.toUpperCase(),
      },
    };
  }

  return agreement;
}

export async function sendOutboundMarketplaceOffer(userId: string, input: OutboundOfferInput) {
  const targetInbox = input.targetInbox?.trim() || (await fetchActorInbox(input.targetActorId));
  const activityId = `${crypto.randomUUID()}`;

  const offerActivity = createActivity({
    id: activityId,
    type: "Offer",
    to: [input.targetActorId],
    cc: [],
    object: agreementPayload(input),
  });

  await sendSignedActivity(targetInbox, offerActivity);

  return prisma.marketplaceOutboundOffer.create({
    data: {
      localUserId: userId,
      activityId: offerActivity.id,
      actorId: listingsActorId(),
      targetProposalId: input.targetProposalId,
      targetActorId: input.targetActorId,
      targetInbox,
      agreementJson: offerActivity.object as Prisma.InputJsonValue,
      status: MarketplaceOutboundOfferStatus.SENT,
      sentAt: new Date(),
    },
    include: {
      agreement: true,
      confirmations: true,
    },
  });
}

export async function listOutboundMarketplaceOffersForUser(userId: string) {
  return prisma.marketplaceOutboundOffer.findMany({
    where: {
      localUserId: userId,
    },
    include: {
      agreement: true,
      confirmations: true,
    },
    orderBy: {
      sentAt: "desc",
    },
  });
}

export async function getOutboundMarketplaceOfferForUser(offerId: string, userId: string) {
  return prisma.marketplaceOutboundOffer.findFirst({
    where: {
      id: offerId,
      localUserId: userId,
    },
    include: {
      agreement: true,
      confirmations: true,
    },
  });
}

export async function applyInboundAcceptToOutboundOffer(activity: InboundActivityPayload) {
  const offerActivityId = extractOfferActivityId(activity.object);
  if (!offerActivityId) {
    return false;
  }

  const outboundOffer = await prisma.marketplaceOutboundOffer.findUnique({
    where: {
      activityId: offerActivityId,
    },
  });

  if (!outboundOffer) {
    return false;
  }

  const now = new Date();
  const agreementJson = asRecord(activity.result);
  const agreementId = extractAgreementIdFromAccept(activity.result);

  await prisma.marketplaceOutboundOffer.update({
    where: {
      id: outboundOffer.id,
    },
    data: {
      status: MarketplaceOutboundOfferStatus.ACCEPTED,
      respondedAt: now,
      responseActivityId: activity.id ?? null,
      responseJson: (activity as unknown as Prisma.InputJsonValue) ?? Prisma.DbNull,
    },
  });

  if (agreementJson && agreementId) {
    await prisma.marketplaceOutboundAgreement.upsert({
      where: {
        outboundOfferId: outboundOffer.id,
      },
      update: {
        agreementId,
        agreementJson: agreementJson as Prisma.InputJsonValue,
        status: MarketplaceAgreementStatus.ACCEPTED,
        acceptedAt: now,
      },
      create: {
        outboundOfferId: outboundOffer.id,
        agreementId,
        agreementJson: agreementJson as Prisma.InputJsonValue,
        status: MarketplaceAgreementStatus.ACCEPTED,
        acceptedAt: now,
      },
    });
  }

  return true;
}

export async function applyInboundRejectToOutboundOffer(activity: InboundActivityPayload) {
  const offerActivityId = extractOfferActivityId(activity.object);
  if (!offerActivityId) {
    return false;
  }

  const outboundOffer = await prisma.marketplaceOutboundOffer.findUnique({
    where: {
      activityId: offerActivityId,
    },
  });

  if (!outboundOffer) {
    return false;
  }

  await prisma.marketplaceOutboundOffer.update({
    where: {
      id: outboundOffer.id,
    },
    data: {
      status: MarketplaceOutboundOfferStatus.REJECTED,
      respondedAt: new Date(),
      responseActivityId: activity.id ?? null,
      responseJson: (activity as unknown as Prisma.InputJsonValue) ?? Prisma.DbNull,
    },
  });

  return true;
}

export async function applyInboundConfirmationToOutboundOffer(activity: InboundActivityPayload) {
  if (activity.type !== "Create") {
    return false;
  }

  const payload = asRecord(activity.object);
  if (!payload || payload.type !== "Document") {
    return false;
  }

  const agreementId = normalizeObjectId(payload.about);
  if (!agreementId) {
    return false;
  }

  const outboundAgreement = await prisma.marketplaceOutboundAgreement.findUnique({
    where: {
      agreementId,
    },
    include: {
      outboundOffer: true,
    },
  });

  if (!outboundAgreement) {
    return false;
  }

  const now = new Date();
  await prisma.marketplaceOutboundAgreement.update({
    where: {
      id: outboundAgreement.id,
    },
    data: {
      status: MarketplaceAgreementStatus.COMPLETED,
      completedAt: now,
    },
  });

  const activityId = normalizeObjectId(payload.id) ?? activity.id ?? `${agreementId}#confirmation-${crypto.randomUUID()}`;

  await prisma.marketplaceOutboundConfirmation.upsert({
    where: {
      activityId,
    },
    update: {
      documentJson: payload as Prisma.InputJsonValue,
      publishedAt: now,
    },
    create: {
      outboundOfferId: outboundAgreement.outboundOfferId,
      outboundAgreementId: outboundAgreement.id,
      activityId,
      documentJson: payload as Prisma.InputJsonValue,
      publishedAt: now,
    },
  });

  return true;
}
