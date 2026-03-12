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
  localListingId?: string | null;
};

type ListingOfferInput = {
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
    const nestedId =
      normalizeObjectId(record.id) ??
      normalizeObjectId(record.agreement) ??
      normalizeObjectId(record.object) ??
      normalizeObjectId(record.about);

    if (nestedId && nestedId.includes("/ap/agreements/")) {
      return nestedId;
    }
  }

  return objectId;
}

function jsonOrNull(value: unknown) {
  if (value === undefined || value === null) {
    return Prisma.DbNull;
  }

  return value as Prisma.InputJsonValue;
}

function normalizeActorFromUnknown(value: unknown) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (value && typeof value === "object") {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string" && id.trim().length > 0) {
      return id.trim();
    }
  }

  return null;
}

function decimalToNumber(value: { toString(): string } | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchActorDocument(actorUrl: string) {
  const response = await fetch(actorUrl, {
    headers: {
      accept: ACTOR_FETCH_ACCEPT_HEADER,
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch target actor ${actorUrl}`);
  }

  return (await response.json()) as {
    inbox?: string;
    endpoints?: {
      sharedInbox?: string;
    };
  };
}

async function fetchActorInbox(actorUrl: string) {
  const actor = await fetchActorDocument(actorUrl);

  if (!actor.inbox) {
    throw new Error(`Target actor ${actorUrl} does not expose inbox`);
  }

  return actor.endpoints?.sharedInbox ?? actor.inbox;
}

async function discoverTargetActorForProposal(params: {
  targetProposalId: string;
  fallbackActorId: string;
}) {
  try {
    const response = await fetch(params.targetProposalId, {
      headers: {
        accept: ACTOR_FETCH_ACCEPT_HEADER,
      },
    });

    if (!response.ok) {
      return params.fallbackActorId;
    }

    const proposal = (await response.json()) as {
      attributedTo?: unknown;
      actor?: unknown;
      to?: unknown;
    };

    return (
      normalizeActorFromUnknown(proposal.attributedTo) ??
      normalizeActorFromUnknown(proposal.actor) ??
      params.fallbackActorId
    );
  } catch {
    return params.fallbackActorId;
  }
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
  const inferredActorId = await discoverTargetActorForProposal({
    targetProposalId: input.targetProposalId,
    fallbackActorId: input.targetActorId,
  });
  const targetInbox = input.targetInbox?.trim() || (await fetchActorInbox(inferredActorId));

  const offerActivity = createActivity({
    id: crypto.randomUUID(),
    type: "Offer",
    to: [inferredActorId],
    cc: [],
    object: agreementPayload({
      ...input,
      targetActorId: inferredActorId,
    }),
  });

  await sendSignedActivity(targetInbox, offerActivity);

  return prisma.marketplaceOutboundOffer.create({
    data: {
      localUserId: userId,
      localListingId: input.localListingId ?? null,
      activityId: offerActivity.id,
      actorId: listingsActorId(),
      targetProposalId: input.targetProposalId,
      targetActorId: inferredActorId,
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

export async function sendOutboundMarketplaceOfferForListing(
  userId: string,
  listingId: string,
  input: ListingOfferInput,
) {
  const listing = await prisma.listing.findUnique({
    where: {
      id: listingId,
    },
    include: {
      proposal: true,
      owner: {
        select: {
          id: true,
          mastodonActorUri: true,
        },
      },
    },
  });

  if (!listing || !listing.proposal) {
    return null;
  }

  if (listing.status !== "ACTIVE" || listing.proposal.status !== "PUBLISHED") {
    throw new Error("Listing is not accepting new offers");
  }

  if (listing.owner.id === userId) {
    throw new Error("You cannot send an offer on your own listing");
  }

  const offeredQuantity = input.quantity ?? 1;
  const minimumQuantity = decimalToNumber(listing.minimumQuantity);
  const availableQuantity = decimalToNumber(listing.availableQuantity);
  const listingCurrency = listing.priceCurrency?.toUpperCase() ?? null;
  const offeredCurrency = input.currency?.toUpperCase() ?? null;

  if (offeredQuantity <= 0) {
    throw new Error("Offer quantity must be greater than zero");
  }

  if (minimumQuantity !== null && offeredQuantity < minimumQuantity) {
    throw new Error(`Offer quantity cannot be lower than minimum quantity (${minimumQuantity})`);
  }

  if (availableQuantity !== null && offeredQuantity > availableQuantity) {
    throw new Error(`Offer quantity cannot exceed available quantity (${availableQuantity})`);
  }

  if (listingCurrency) {
    if (!offeredCurrency) {
      throw new Error(`Offer currency is required and must be ${listingCurrency}`);
    }
    if (offeredCurrency !== listingCurrency) {
      throw new Error(`Offer currency must match listing currency (${listingCurrency})`);
    }
  }

  return sendOutboundMarketplaceOffer(userId, {
    targetProposalId: listing.proposal.activityPubId,
    targetActorId: listing.owner.mastodonActorUri,
    note: input.note,
    quantity: offeredQuantity,
    unitCode: input.unitCode,
    amount: input.amount,
    currency: offeredCurrency,
    localListingId: listing.id,
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

export async function listOutboundMarketplaceOffersForUserAndListing(userId: string, listingId: string) {
  return prisma.marketplaceOutboundOffer.findMany({
    where: {
      localUserId: userId,
      localListingId: listingId,
    },
    include: {
      agreement: true,
      confirmations: true,
    },
    orderBy: {
      sentAt: "desc",
    },
    take: 10,
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

export async function listOutboundMarketplaceAgreementsForUser(userId: string) {
  return prisma.marketplaceOutboundAgreement.findMany({
    where: {
      outboundOffer: {
        localUserId: userId,
      },
    },
    include: {
      outboundOffer: {
        select: {
          id: true,
          targetProposalId: true,
          targetActorId: true,
          status: true,
          sentAt: true,
        },
      },
      confirmations: true,
    },
    orderBy: [
      {
        acceptedAt: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
  });
}

export async function getOutboundMarketplaceAgreementForUser(agreementId: string, userId: string) {
  return prisma.marketplaceOutboundAgreement.findFirst({
    where: {
      id: agreementId,
      outboundOffer: {
        localUserId: userId,
      },
    },
    include: {
      outboundOffer: true,
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
      responseJson: jsonOrNull(activity),
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
      responseJson: jsonOrNull(activity),
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

  const activityId =
    normalizeObjectId(payload.id) ?? activity.id ?? `${agreementId}#confirmation-${crypto.randomUUID()}`;

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
