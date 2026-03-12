import { MarketplaceAgreementStatus, MarketplaceOfferStatus, Prisma } from "@prisma/client";
import { agreementObjectId, createActivity, listingsActorId } from "@/lib/activitypub";
import {
  createMarketplaceAgreementObject,
  createMarketplaceConfirmationDocument,
} from "@/lib/activitypub-marketplace";
import { enqueueActivityDelivery } from "@/lib/delivery-queue";
import { prisma } from "@/lib/prisma";

type RemoteTarget = {
  actor: string;
  inbox: string;
};

function asObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function normalizeOfferReference(activityId: string) {
  return {
    id: activityId,
    type: "Offer",
    actor: listingsActorId(),
  };
}

export async function recordInboundMarketplaceOffer(params: {
  activityId: string;
  remoteActorId: string;
  remoteInbox: string;
  proposalActivityPubId: string;
  agreementJson: Record<string, unknown>;
}) {
  const proposal = await prisma.marketplaceProposal.findUnique({
    where: {
      activityPubId: params.proposalActivityPubId,
    },
    include: {
      listing: {
        include: {
          owner: {
            select: {
              id: true,
              mastodonActorUri: true,
            },
          },
        },
      },
    },
  });

  if (!proposal) {
    return null;
  }

  return prisma.marketplaceOffer.upsert({
    where: {
      activityId: params.activityId,
    },
    update: {
      remoteActorId: params.remoteActorId,
      remoteInbox: params.remoteInbox,
      agreementJson: params.agreementJson as Prisma.InputJsonValue,
    },
    create: {
      proposalId: proposal.id,
      activityId: params.activityId,
      remoteActorId: params.remoteActorId,
      remoteInbox: params.remoteInbox,
      agreementJson: params.agreementJson as Prisma.InputJsonValue,
      status: "RECEIVED",
    },
    include: {
      proposal: {
        include: {
          listing: {
            include: {
              owner: {
                select: {
                  id: true,
                  mastodonActorUri: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function listMarketplaceOffersForUser(userId: string) {
  return prisma.marketplaceOffer.findMany({
    where: {
      proposal: {
        listing: {
          ownerId: userId,
        },
      },
    },
    include: {
      proposal: {
        include: {
          listing: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
      agreement: true,
    },
    orderBy: {
      receivedAt: "desc",
    },
  });
}

export async function getMarketplaceOfferForUser(offerId: string, userId: string) {
  const offer = await prisma.marketplaceOffer.findUnique({
    where: {
      id: offerId,
    },
    include: {
      proposal: {
        include: {
          listing: {
            include: {
              owner: {
                select: {
                  id: true,
                  mastodonActorUri: true,
                },
              },
            },
          },
        },
      },
      agreement: true,
    },
  });

  if (!offer) {
    return null;
  }

  if (offer.proposal.listing.owner.id !== userId) {
    return null;
  }

  return offer;
}

async function enqueueOfferResponse(params: {
  target: RemoteTarget;
  listingId: string;
  proposalId: string;
  offerId: string;
  agreementId?: string;
  activity: Record<string, unknown> & { id: string; type: string };
}) {
  await enqueueActivityDelivery({
    id: params.activity.id,
    type: params.activity.type,
    listingId: params.listingId,
    proposalId: params.proposalId,
    offerId: params.offerId,
    agreementId: params.agreementId,
    projectionType: "MARKETPLACE_RESPONSE",
    body: params.activity,
    targets: [
      {
        actor: params.target.actor,
        inbox: params.target.inbox,
      },
    ],
  });
}

export async function acceptMarketplaceOffer(offerId: string, userId: string) {
  const offer = await getMarketplaceOfferForUser(offerId, userId);
  if (!offer) {
    return null;
  }

  if (offer.status !== "RECEIVED") {
    return {
      offer,
      agreement: offer.agreement,
    };
  }

  const now = new Date();
  const agreementId = crypto.randomUUID();
  const agreementActivityPubId = agreementObjectId(agreementId);

  const agreementPayload = {
    ...asObject(offer.agreementJson),
    type: "Agreement",
    id: agreementActivityPubId,
    basedOn: offer.proposal.activityPubId,
    seller: offer.proposal.listing.owner.mastodonActorUri,
    buyer: offer.remoteActorId,
  };

  const agreement = await prisma.marketplaceAgreement.create({
    data: {
      id: agreementId,
      proposalId: offer.proposalId,
      offerId: offer.id,
      activityPubId: agreementActivityPubId,
      sellerActorId: offer.proposal.listing.owner.mastodonActorUri,
      buyerActorId: offer.remoteActorId,
      agreementJson: agreementPayload as Prisma.InputJsonValue,
      status: MarketplaceAgreementStatus.ACCEPTED,
      acceptedAt: now,
    },
  });

  const updatedOffer = await prisma.marketplaceOffer.update({
    where: {
      id: offer.id,
    },
    data: {
      status: MarketplaceOfferStatus.ACCEPTED,
      respondedAt: now,
    },
  });

  const agreementObject = createMarketplaceAgreementObject({
    id: agreement.activityPubId,
    proposalId: offer.proposal.activityPubId,
    sellerActorId: agreement.sellerActorId,
    buyerActorId: agreement.buyerActorId,
    acceptedAt: agreement.acceptedAt,
    agreement: agreementPayload,
  });

  const acceptActivity = createActivity({
    id: crypto.randomUUID(),
    type: "Accept",
    to: [offer.remoteActorId],
    cc: [],
    object: normalizeOfferReference(offer.activityId),
    result: agreementObject,
  });

  await enqueueOfferResponse({
    target: {
      actor: offer.remoteActorId,
      inbox: offer.remoteInbox,
    },
    listingId: offer.proposal.listingId,
    proposalId: offer.proposalId,
    offerId: offer.id,
    agreementId: agreement.id,
    activity: acceptActivity,
  });

  return {
    offer: updatedOffer,
    agreement,
  };
}

export async function rejectMarketplaceOffer(offerId: string, userId: string, reason?: string) {
  const offer = await getMarketplaceOfferForUser(offerId, userId);
  if (!offer) {
    return null;
  }

  if (offer.status !== "RECEIVED") {
    return {
      offer,
    };
  }

  const now = new Date();
  const updatedOffer = await prisma.marketplaceOffer.update({
    where: {
      id: offer.id,
    },
    data: {
      status: MarketplaceOfferStatus.REJECTED,
      respondedAt: now,
    },
  });

  const rejectActivity = createActivity({
    id: crypto.randomUUID(),
    type: "Reject",
    to: [offer.remoteActorId],
    cc: [],
    object: normalizeOfferReference(offer.activityId),
    ...(reason ? { result: { reason } } : {}),
  });

  await enqueueOfferResponse({
    target: {
      actor: offer.remoteActorId,
      inbox: offer.remoteInbox,
    },
    listingId: offer.proposal.listingId,
    proposalId: offer.proposalId,
    offerId: offer.id,
    activity: rejectActivity,
  });

  return {
    offer: updatedOffer,
  };
}

export async function listMarketplaceAgreementsForUser(userId: string) {
  return prisma.marketplaceAgreement.findMany({
    where: {
      proposal: {
        listing: {
          ownerId: userId,
        },
      },
    },
    include: {
      proposal: {
        include: {
          listing: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
      offer: true,
      confirmations: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getMarketplaceAgreementForUser(agreementId: string, userId: string) {
  const agreement = await prisma.marketplaceAgreement.findUnique({
    where: {
      id: agreementId,
    },
    include: {
      proposal: {
        include: {
          listing: {
            include: {
              owner: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      },
      offer: true,
      confirmations: true,
    },
  });

  if (!agreement) {
    return null;
  }

  if (agreement.proposal.listing.owner.id !== userId) {
    return null;
  }

  return agreement;
}

export async function completeMarketplaceAgreement(agreementId: string, userId: string) {
  const agreement = await getMarketplaceAgreementForUser(agreementId, userId);
  if (!agreement) {
    return null;
  }

  if (!agreement.offer) {
    throw new Error("Agreement is missing its originating offer target");
  }

  const now = new Date();
  const updatedAgreement = await prisma.marketplaceAgreement.update({
    where: {
      id: agreement.id,
    },
    data: {
      status: MarketplaceAgreementStatus.COMPLETED,
      completedAt: now,
    },
  });

  await prisma.marketplaceCommitment.create({
    data: {
      agreementId: agreement.id,
      kind: "FULFILLMENT",
      status: "COMPLETED",
      commitmentJson: {
        completedAt: now.toISOString(),
      } as Prisma.InputJsonValue,
    },
  });

  const confirmationDocument = createMarketplaceConfirmationDocument({
    id: `${updatedAgreement.activityPubId}#confirmation-${crypto.randomUUID()}`,
    agreementId: updatedAgreement.activityPubId,
    proposalId: agreement.proposal.activityPubId,
    completedAt: now,
  });

  const confirmationActivity = createActivity({
    id: crypto.randomUUID(),
    type: "Create",
    to: [agreement.offer.remoteActorId],
    cc: [],
    object: confirmationDocument,
  });

  await prisma.marketplaceConfirmation.create({
    data: {
      agreementId: agreement.id,
      activityId: confirmationActivity.id,
      documentJson: confirmationDocument as Prisma.InputJsonValue,
      publishedAt: now,
    },
  });

  await enqueueActivityDelivery({
    id: confirmationActivity.id,
    type: confirmationActivity.type,
    listingId: agreement.proposal.listingId,
    proposalId: agreement.proposalId,
    agreementId: agreement.id,
    projectionType: "MARKETPLACE_CONFIRMATION",
    body: confirmationActivity,
    targets: [
      {
        actor: agreement.offer.remoteActorId,
        inbox: agreement.offer.remoteInbox,
      },
    ],
  });

  return {
    agreement: updatedAgreement,
    confirmation: confirmationDocument,
  };
}
