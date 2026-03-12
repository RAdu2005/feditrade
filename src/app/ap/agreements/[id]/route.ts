import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { createMarketplaceAgreementObject } from "@/lib/activitypub-marketplace";

type Params = {
  params: Promise<{ id: string }>;
};

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export async function GET(_: Request, context: Params) {
  const { id } = await context.params;
  const agreement = await prisma.marketplaceAgreement.findUnique({
    where: {
      id,
    },
    include: {
      proposal: true,
    },
  });

  if (!agreement) {
    return jsonError("Agreement not found", 404);
  }

  const agreementObject = createMarketplaceAgreementObject({
    id: agreement.activityPubId,
    proposalId: agreement.proposal.activityPubId,
    sellerActorId: agreement.sellerActorId,
    buyerActorId: agreement.buyerActorId,
    acceptedAt: agreement.acceptedAt,
    agreement: asRecord(agreement.agreementJson),
  });

  return jsonOk(agreementObject, {
    headers: {
      "content-type": "application/activity+json",
    },
  });
}
