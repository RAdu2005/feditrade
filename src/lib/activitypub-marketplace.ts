import {
  ACTIVITY_STREAMS_CONTEXT,
  buildListingAttachments,
  defaultAudience,
  listingsActorId,
} from "@/lib/activitypub";

export const VALUEFLOWS_CONTEXT = "https://w3id.org/valueflows/v1";

const VALUEFLOWS_TERMS = {
  purpose: "https://w3id.org/valueflows/ont/vf#purpose",
  publishes: "https://w3id.org/valueflows/ont/vf#publishes",
  reciprocal: "https://w3id.org/valueflows/ont/vf#reciprocal",
  unitBased: "https://w3id.org/valueflows/ont/vf#unitBased",
  resourceConformsTo: "https://w3id.org/valueflows/ont/vf#resourceConformsTo",
  resourceQuantity: "https://w3id.org/valueflows/ont/vf#resourceQuantity",
  availableQuantity: "https://w3id.org/valueflows/ont/vf#availableQuantity",
  minimumQuantity: "https://w3id.org/valueflows/ont/vf#minimumQuantity",
  hasUnit: "https://w3id.org/valueflows/ont/vf#hasUnit",
  hasNumericalValue: "https://w3id.org/valueflows/ont/vf#hasNumericalValue",
  provider: "https://w3id.org/valueflows/ont/vf#provider",
  receiver: "https://w3id.org/valueflows/ont/vf#receiver",
};

type QuantityInput = {
  value: string;
  unitCode?: string | null;
};

type MarketplaceProposalInput = {
  id: string;
  canonicalUrl: string;
  title: string;
  description: string;
  ownerActorUri: string;
  ownerHandle?: string | null;
  updatedAt: Date;
  purpose: "offer" | "request";
  publishes: Record<string, unknown>;
  reciprocal?: Record<string, unknown> | null;
  unitBased?: boolean;
  availableQuantity?: QuantityInput | null;
  minimumQuantity?: QuantityInput | null;
  location?: string | null;
  imageAttachments?: Array<{ url: string; mediaType?: string | null }>;
};

type MarketplaceAgreementInput = {
  id: string;
  proposalId: string;
  sellerActorId: string;
  buyerActorId: string;
  acceptedAt?: Date | null;
  agreement: Record<string, unknown>;
};

type MarketplaceConfirmationInput = {
  id: string;
  agreementId: string;
  proposalId: string;
  completedAt: Date;
};

function context() {
  return [ACTIVITY_STREAMS_CONTEXT, VALUEFLOWS_CONTEXT, VALUEFLOWS_TERMS] as const;
}

function quantityToValue(quantity: QuantityInput) {
  return {
    hasNumericalValue: Number(quantity.value),
    ...(quantity.unitCode ? { hasUnit: quantity.unitCode } : {}),
  };
}

export function createMarketplaceProposalObject(input: MarketplaceProposalInput) {
  const audience = defaultAudience();

  return {
    "@context": context(),
    id: input.id,
    type: "Proposal",
    attributedTo: listingsActorId(),
    name: input.title,
    summary: input.description,
    url: input.canonicalUrl,
    purpose: input.purpose,
    publishes: input.publishes,
    ...(input.reciprocal ? { reciprocal: input.reciprocal } : {}),
    unitBased: input.unitBased ?? false,
    ...(input.availableQuantity
      ? { availableQuantity: quantityToValue(input.availableQuantity) }
      : {}),
    ...(input.minimumQuantity
      ? { minimumQuantity: quantityToValue(input.minimumQuantity) }
      : {}),
    ...(input.location
      ? {
          location: {
            type: "Place",
            name: input.location,
          },
        }
      : {}),
    seller: {
      id: input.ownerActorUri,
      type: "Person",
      ...(input.ownerHandle ? { preferredUsername: input.ownerHandle } : {}),
    },
    published: input.updatedAt.toISOString(),
    updated: input.updatedAt.toISOString(),
    to: audience.to,
    cc: audience.cc,
    attachment: buildListingAttachments({
      imageAttachments: input.imageAttachments,
    }),
  };
}

export function createMarketplaceAgreementObject(input: MarketplaceAgreementInput) {
  return {
    "@context": context(),
    id: input.id,
    type: "Agreement",
    attributedTo: listingsActorId(),
    basedOn: input.proposalId,
    provider: input.sellerActorId,
    receiver: input.buyerActorId,
    acceptedAt: input.acceptedAt?.toISOString() ?? new Date().toISOString(),
    ...input.agreement,
  };
}

export function createMarketplaceConfirmationDocument(input: MarketplaceConfirmationInput) {
  return {
    "@context": context(),
    id: input.id,
    type: "Document",
    name: "Marketplace transaction confirmation",
    published: input.completedAt.toISOString(),
    about: input.agreementId,
    basedOn: input.proposalId,
    content:
      "This confirmation indicates the agreement has been completed off-protocol and is now finalized.",
  };
}
