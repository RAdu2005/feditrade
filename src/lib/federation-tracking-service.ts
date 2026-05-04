import { MarketplaceProposalPurpose, Prisma } from "@prisma/client";
import {
  ACTOR_FETCH_ACCEPT_HEADER,
  createActivity,
  listingsActorId,
  signFederatedRequest,
} from "@/lib/activitypub";
import { prisma } from "@/lib/prisma";

type ActivityPayload = {
  id?: string;
  type?: string;
  actor?: string;
  object?: unknown;
  [key: string]: unknown;
};

type ProposalObject = Record<string, unknown> & {
  id?: unknown;
  type?: unknown;
  url?: unknown;
  name?: unknown;
  title?: unknown;
  summary?: unknown;
  content?: unknown;
  purpose?: unknown;
  publishes?: unknown;
  reciprocal?: unknown;
  availableQuantity?: unknown;
  minimumQuantity?: unknown;
  resourceConformsTo?: unknown;
  attributedTo?: unknown;
  location?: unknown;
  attachment?: unknown;
  validFrom?: unknown;
  validUntil?: unknown;
  published?: unknown;
  updated?: unknown;
};

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value;
}

function normalizeUrlish(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizeObjectId(value: unknown) {
  if (typeof value === "string" && value.trim().length > 0) {
    return normalizeUrlish(value.trim());
  }

  if (value && typeof value === "object") {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string" && id.trim().length > 0) {
      return normalizeUrlish(id.trim());
    }
  }

  return null;
}

function normalizeDomainLike(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.host.toLowerCase();
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "")
      .split("/")[0]
      ?.toLowerCase() ?? null;
  }
}

function preferredProtocolForDomain(domain: string) {
  const host = domain.split(":")[0]?.toLowerCase() ?? domain.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") {
    return "http";
  }

  return "https";
}

function originFromDomain(domain: string) {
  return `${preferredProtocolForDomain(domain)}://${domain}`;
}

function parseDateOrNull(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return null;
  }

  return parsed;
}

function toDecimal(value: unknown, scale: number) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return new Prisma.Decimal(parsed.toFixed(scale));
}

function readQuantityValue(value: unknown) {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  return toDecimal(record.hasNumericalValue, 4);
}

function readQuantityUnit(value: unknown) {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  if (typeof record.hasUnit !== "string") {
    return null;
  }

  const cleaned = record.hasUnit.trim().toUpperCase();
  return cleaned || null;
}

function parseIsoCurrency(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(cleaned)) {
    return cleaned;
  }

  const urnMatch = cleaned.match(/:([A-Z]{3})$/);
  return urnMatch ? urnMatch[1] : null;
}

function extractPriceFromReciprocal(value: unknown) {
  const reciprocal = asRecord(value);
  if (!reciprocal) {
    return {
      amount: null,
      currency: null,
    };
  }

  const quantity = asRecord(reciprocal.resourceQuantity);
  const amount = quantity ? toDecimal(quantity.hasNumericalValue, 2) : null;
  const currency =
    parseIsoCurrency(quantity?.hasUnit) ??
    parseIsoCurrency(reciprocal.hasUnit) ??
    parseIsoCurrency(reciprocal.resourceConformsTo) ??
    null;

  return {
    amount,
    currency,
  };
}

function extractLocation(value: unknown) {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  if (typeof record.name === "string") {
    const cleaned = record.name.trim();
    return cleaned || null;
  }

  return null;
}

function extractImageAttachments(value: unknown) {
  return asArray(value)
    .map((item) => {
      const record = asRecord(item);
      if (!record || typeof record.url !== "string") {
        return null;
      }

      return {
        type: typeof record.type === "string" ? record.type : "Image",
        url: record.url,
        mediaType: typeof record.mediaType === "string" ? record.mediaType : null,
      };
    })
    .filter((item): item is { type: string; url: string; mediaType: string | null } => Boolean(item));
}

function toProposalPurpose(value: unknown): MarketplaceProposalPurpose {
  if (typeof value === "string" && value.trim().toLowerCase() === "request") {
    return "REQUEST";
  }

  return "OFFER";
}

function parseTrackingInput(input: string) {
  const raw = input.trim();
  if (!raw) {
    throw new Error("Tracking source is required");
  }

  const normalizedDomain = normalizeDomainLike(raw);
  if (normalizedDomain && !raw.includes("/")) {
    return {
      kind: "domain" as const,
      domain: normalizedDomain,
    };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Provide a valid instance domain or listing URL");
  }

  const domain = normalizeDomainLike(url.host);
  if (!domain) {
    throw new Error("Could not determine source domain");
  }

  const normalizedPath = url.pathname.replace(/\/+$/, "");
  if (!normalizedPath || normalizedPath === "") {
    return {
      kind: "domain" as const,
      domain,
    };
  }

  return {
    kind: "listing" as const,
    domain,
    url,
  };
}

function resolveProposalUrlFromListingUrl(url: URL) {
  const pathname = url.pathname.replace(/\/+$/, "");
  if (pathname.includes("/ap/proposals/")) {
    return normalizeUrlish(url.toString());
  }

  const listingMatch = pathname.match(/\/listings\/([^/]+)$/);
  if (listingMatch?.[1]) {
    return `${url.origin}/ap/proposals/${listingMatch[1]}`;
  }

  return normalizeUrlish(url.toString());
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: ACTOR_FETCH_ACCEPT_HEADER,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.json() as Promise<unknown>;
}

async function discoverActorViaWebFinger(domain: string) {
  const origin = originFromDomain(domain);
  const resource = `acct:listings@${domain}`;
  const webfingerUrl = `${origin}/.well-known/webfinger?resource=${encodeURIComponent(resource)}`;

  try {
    const response = await fetch(webfingerUrl, {
      headers: {
        accept: "application/jrd+json, application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      links?: Array<{ rel?: string; type?: string; href?: string }>;
    };

    const selfLink = payload.links?.find(
      (link) =>
        link.rel === "self" &&
        typeof link.href === "string" &&
        (link.type?.includes("activity+json") ?? true),
    );

    return selfLink?.href ? normalizeUrlish(selfLink.href) : null;
  } catch {
    return null;
  }
}

async function discoverActorFromDomain(domain: string) {
  const viaWebFinger = await discoverActorViaWebFinger(domain);
  if (viaWebFinger) {
    return viaWebFinger;
  }

  return `${originFromDomain(domain)}/ap/actor/listings`;
}

async function fetchActorInbox(actorId: string) {
  const actor = (await fetchJson(actorId)) as {
    inbox?: unknown;
    endpoints?: {
      sharedInbox?: unknown;
    };
  };

  if (typeof actor.inbox !== "string" || actor.inbox.trim().length === 0) {
    throw new Error(`Actor ${actorId} does not expose inbox`);
  }

  return {
    inbox: actor.inbox,
    sharedInbox: typeof actor.endpoints?.sharedInbox === "string" ? actor.endpoints.sharedInbox : null,
  };
}

async function sendSignedActivity(targetInbox: string, activity: Record<string, unknown>) {
  const body = JSON.stringify(activity);
  const targetUrl = new URL(targetInbox);
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
    const responseText = (await response.text()).slice(0, 300).replace(/\s+/g, " ");
    throw new Error(
      `Remote inbox responded ${response.status}${responseText ? ` (${responseText})` : ""}`,
    );
  }
}

async function sendFollowRequest(actorId: string, inbox: string, sharedInbox: string | null) {
  const follow = createActivity({
    id: crypto.randomUUID(),
    type: "Follow",
    to: [actorId],
    cc: [],
    object: actorId,
    actor: listingsActorId(),
  });

  await sendSignedActivity(sharedInbox ?? inbox, follow);
  return follow.id;
}

function extractCanonicalUrl(proposal: ProposalObject) {
  if (typeof proposal.url === "string" && proposal.url.trim().length > 0) {
    return proposal.url;
  }

  const id = normalizeObjectId(proposal.id);
  if (id) {
    try {
      const parsed = new URL(id);
      if (parsed.pathname.includes("/ap/proposals/")) {
        const listingId = parsed.pathname.split("/").filter(Boolean).pop();
        if (listingId) {
          return `${parsed.origin}/listings/${listingId}`;
        }
      }
    } catch {
      return id;
    }
  }

  return "";
}

function parseProposalTitle(proposal: ProposalObject) {
  if (typeof proposal.name === "string" && proposal.name.trim().length > 0) {
    return proposal.name.trim();
  }

  if (typeof proposal.title === "string" && proposal.title.trim().length > 0) {
    return proposal.title.trim();
  }

  return "Untitled listing";
}

function parseProposalDescription(proposal: ProposalObject) {
  if (typeof proposal.summary === "string" && proposal.summary.trim().length > 0) {
    return proposal.summary.trim();
  }

  if (typeof proposal.content === "string" && proposal.content.trim().length > 0) {
    return proposal.content.trim();
  }

  return "No description provided.";
}

function parseProposalCategory(proposal: ProposalObject) {
  const publishes = asRecord(proposal.publishes);
  if (!publishes) {
    return null;
  }

  if (typeof publishes.resourceConformsTo === "string") {
    return publishes.resourceConformsTo;
  }

  return null;
}

function parseResourceConformsTo(proposal: ProposalObject) {
  if (typeof proposal.resourceConformsTo === "string") {
    return proposal.resourceConformsTo;
  }

  const publishes = asRecord(proposal.publishes);
  if (!publishes) {
    return null;
  }

  if (typeof publishes.resourceConformsTo === "string") {
    return publishes.resourceConformsTo;
  }

  return null;
}

function parseProposalActor(proposal: ProposalObject, fallbackActor: string) {
  const attributedTo = normalizeObjectId(proposal.attributedTo);
  if (attributedTo) {
    return attributedTo;
  }

  return fallbackActor;
}

function deriveUsernameFromActor(actorId: string) {
  try {
    const parsed = new URL(actorId);
    const pathname = parsed.pathname.replace(/\/+$/, "");
    const segments = pathname.split("/").filter(Boolean);

    if (segments.length === 1 && segments[0]?.startsWith("@")) {
      return segments[0].slice(1);
    }

    if (segments.length >= 2 && segments[0]?.toLowerCase() === "users") {
      return segments[1] ?? actorId;
    }
  } catch {
    return actorId;
  }

  return actorId;
}

async function upsertFederatedListingFromProposal(params: {
  trackedInstanceId: string;
  sourceDomain: string;
  fallbackActorId: string;
  proposal: ProposalObject;
}) {
  const proposalId = normalizeObjectId(params.proposal.id);
  if (!proposalId) {
    throw new Error("Proposal is missing id");
  }

  const canonicalUrl = extractCanonicalUrl(params.proposal);
  const title = parseProposalTitle(params.proposal);
  const description = parseProposalDescription(params.proposal);
  const purpose = toProposalPurpose(params.proposal.purpose);
  const availableQuantity = readQuantityValue(params.proposal.availableQuantity);
  const minimumQuantity = readQuantityValue(params.proposal.minimumQuantity);
  const unitCode =
    readQuantityUnit(params.proposal.availableQuantity) ?? readQuantityUnit(params.proposal.minimumQuantity) ?? null;
  const { amount, currency } = extractPriceFromReciprocal(params.proposal.reciprocal);
  const remoteActorId = parseProposalActor(params.proposal, params.fallbackActorId);
  const now = new Date();

  return prisma.federatedListing.upsert({
    where: {
      proposalId,
    },
    update: {
      trackedInstanceId: params.trackedInstanceId,
      sourceDomain: params.sourceDomain,
      remoteActorId,
      canonicalUrl,
      title,
      description,
      priceAmount: amount,
      priceCurrency: currency,
      location: extractLocation(params.proposal.location),
      category: parseProposalCategory(params.proposal),
      proposalPurpose: purpose,
      availableQuantity,
      minimumQuantity,
      unitCode,
      resourceConformsTo: parseResourceConformsTo(params.proposal),
      validFrom: parseDateOrNull(params.proposal.validFrom),
      validUntil: parseDateOrNull(params.proposal.validUntil),
      status: "ACTIVE",
      imageAttachmentsJson: extractImageAttachments(params.proposal.attachment) as Prisma.InputJsonValue,
      rawProposalJson: params.proposal as Prisma.InputJsonValue,
      publishedAt: parseDateOrNull(params.proposal.published),
      updatedAtRemote: parseDateOrNull(params.proposal.updated),
      lastSeenAt: now,
    },
    create: {
      trackedInstanceId: params.trackedInstanceId,
      sourceDomain: params.sourceDomain,
      remoteActorId,
      proposalId,
      canonicalUrl,
      title,
      description,
      priceAmount: amount,
      priceCurrency: currency,
      location: extractLocation(params.proposal.location),
      category: parseProposalCategory(params.proposal),
      proposalPurpose: purpose,
      availableQuantity,
      minimumQuantity,
      unitCode,
      resourceConformsTo: parseResourceConformsTo(params.proposal),
      validFrom: parseDateOrNull(params.proposal.validFrom),
      validUntil: parseDateOrNull(params.proposal.validUntil),
      status: "ACTIVE",
      imageAttachmentsJson: extractImageAttachments(params.proposal.attachment) as Prisma.InputJsonValue,
      rawProposalJson: params.proposal as Prisma.InputJsonValue,
      publishedAt: parseDateOrNull(params.proposal.published),
      updatedAtRemote: parseDateOrNull(params.proposal.updated),
      firstSeenAt: now,
      lastSeenAt: now,
    },
  });
}

async function fetchProposalObject(proposalUrl: string) {
  const payload = (await fetchJson(proposalUrl)) as ProposalObject;
  if (payload.type !== "Proposal") {
    throw new Error("Provided URL does not resolve to a Proposal object");
  }

  return payload;
}

export async function ensureTrackedInstanceForDomain(userId: string, domainInput: string) {
  const domain = normalizeDomainLike(domainInput);
  if (!domain) {
    throw new Error("Invalid instance domain");
  }

  const actorId = await discoverActorFromDomain(domain);
  const { inbox, sharedInbox } = await fetchActorInbox(actorId);

  const tracked = await prisma.federationTrackedInstance.upsert({
    where: {
      domain,
    },
    update: {
      actorId,
      inbox,
      sharedInbox,
      followStatus: "PENDING",
      followError: null,
      lastFollowAttemptAt: new Date(),
    },
    create: {
      domain,
      actorId,
      inbox,
      sharedInbox,
      createdByUserId: userId,
      followStatus: "PENDING",
      lastFollowAttemptAt: new Date(),
    },
  });

  try {
    await sendFollowRequest(actorId, inbox, sharedInbox);
  } catch (error) {
    await prisma.federationTrackedInstance.update({
      where: {
        id: tracked.id,
      },
      data: {
        followStatus: "ERROR",
        followError: error instanceof Error ? error.message.slice(0, 2000) : "Failed to send follow",
      },
    });
    throw error;
  }

  return tracked;
}

export async function importSpecificRemoteListing(params: {
  trackedInstanceId: string;
  sourceDomain: string;
  fallbackActorId: string;
  listingUrl: URL;
}) {
  const proposalUrl = resolveProposalUrlFromListingUrl(params.listingUrl);
  const proposal = await fetchProposalObject(proposalUrl);

  return upsertFederatedListingFromProposal({
    trackedInstanceId: params.trackedInstanceId,
    sourceDomain: params.sourceDomain,
    fallbackActorId: params.fallbackActorId,
    proposal,
  });
}

export async function trackSourceFromInput(userId: string, input: string) {
  const parsed = parseTrackingInput(input);

  if (parsed.kind === "domain") {
    const trackedInstance = await ensureTrackedInstanceForDomain(userId, parsed.domain);
    return {
      trackedInstance,
      importedListing: null,
    };
  }

  const trackedInstance = await ensureTrackedInstanceForDomain(userId, parsed.domain);
  const importedListing = await importSpecificRemoteListing({
    trackedInstanceId: trackedInstance.id,
    sourceDomain: trackedInstance.domain,
    fallbackActorId: trackedInstance.actorId,
    listingUrl: parsed.url,
  });

  return {
    trackedInstance,
    importedListing,
  };
}

async function resolveActivityObject(activity: ActivityPayload) {
  if (!activity.object) {
    return null;
  }

  if (typeof activity.object === "string") {
    try {
      return (await fetchJson(activity.object)) as ProposalObject;
    } catch {
      return null;
    }
  }

  return asRecord(activity.object) as ProposalObject | null;
}

export async function processTrackedInstanceProposalActivity(activity: ActivityPayload) {
  if (!activity.actor || !activity.type) {
    return false;
  }

  const tracked = await prisma.federationTrackedInstance.findUnique({
    where: {
      actorId: normalizeUrlish(activity.actor),
    },
  });

  if (!tracked) {
    return false;
  }

  if (activity.type === "Delete") {
    const proposalId = normalizeObjectId(activity.object);
    if (!proposalId) {
      return true;
    }

    await prisma.federatedListing.updateMany({
      where: {
        proposalId,
      },
      data: {
        status: "REMOVED",
        lastSeenAt: new Date(),
      },
    });
    return true;
  }

  if (activity.type !== "Create" && activity.type !== "Update") {
    return false;
  }

  const object = await resolveActivityObject(activity);
  if (!object || object.type !== "Proposal") {
    return true;
  }

  await upsertFederatedListingFromProposal({
    trackedInstanceId: tracked.id,
    sourceDomain: tracked.domain,
    fallbackActorId: tracked.actorId,
    proposal: object,
  });

  return true;
}

function toSourceStatusValue(value: string): "pending" | "accepted" | "error" {
  if (value === "ERROR") {
    return "error";
  }

  if (value === "ACCEPTED") {
    return "accepted";
  }

  return "pending";
}

function imageListFromJson(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const record = asRecord(item);
      if (!record || typeof record.url !== "string") {
        return null;
      }

      return {
        id: `remote-image-${index + 1}`,
        url: record.url,
        mediaType: typeof record.mediaType === "string" ? record.mediaType : null,
      };
    })
    .filter((item): item is { id: string; url: string; mediaType: string | null } => Boolean(item));
}

function federatedListingToApi(listing: {
  id: string;
  sourceDomain: string;
  title: string;
  description: string;
  priceAmount: Prisma.Decimal | null;
  priceCurrency: string | null;
  location: string | null;
  category: string | null;
  proposalPurpose: MarketplaceProposalPurpose;
  availableQuantity: Prisma.Decimal | null;
  minimumQuantity: Prisma.Decimal | null;
  unitCode: string | null;
  resourceConformsTo: string | null;
  status: string;
  canonicalUrl: string;
  proposalId: string;
  remoteActorId: string;
  publishedAt: Date | null;
  updatedAtRemote: Date | null;
  createdAt: Date;
  updatedAt: Date;
  imageAttachmentsJson: unknown;
}) {
  return {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    priceAmount: listing.priceAmount ? listing.priceAmount.toString() : null,
    priceCurrency: listing.priceCurrency,
    location: listing.location,
    category: listing.category,
    proposalPurpose: listing.proposalPurpose === "REQUEST" ? "request" : "offer",
    availableQuantity: listing.availableQuantity?.toString() ?? null,
    minimumQuantity: listing.minimumQuantity?.toString() ?? null,
    unitCode: listing.unitCode,
    resourceConformsTo: listing.resourceConformsTo,
    status: listing.status,
    canonicalUrl: listing.canonicalUrl,
    proposalUrl: listing.proposalId,
    remoteActorId: listing.remoteActorId,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
    publishedAt: listing.publishedAt?.toISOString() ?? null,
    updatedAtRemote: listing.updatedAtRemote?.toISOString() ?? null,
    sourceDomain: listing.sourceDomain,
    originType: "remote" as const,
    originDomain: listing.sourceDomain,
    detailHref: `/federated-listings/${listing.id}`,
    canSendOffer: listing.status === "ACTIVE",
    owner: {
      actorUri: listing.remoteActorId,
      username: deriveUsernameFromActor(listing.remoteActorId),
      image: null,
    },
    images: imageListFromJson(listing.imageAttachmentsJson),
  };
}

export async function listTrackedSourcesWithActiveListings() {
  const sources = await prisma.federationTrackedInstance.findMany({
    include: {
      federatedListings: {
        where: {
          status: "ACTIVE",
        },
        orderBy: [
          {
            createdAt: "desc",
          },
          {
            id: "desc",
          },
        ],
      },
    },
    orderBy: [
      {
        domain: "asc",
      },
    ],
  });

  return sources.map((source) => ({
    id: source.id,
    domain: source.domain,
    actorId: source.actorId,
    inbox: source.inbox,
    sharedInbox: source.sharedInbox,
    followStatus: toSourceStatusValue(source.followStatus),
    followError: source.followError,
    lastFollowAttemptAt: source.lastFollowAttemptAt?.toISOString() ?? null,
    lastFollowAcceptedAt: source.lastFollowAcceptedAt?.toISOString() ?? null,
    trackedAt: source.createdAt.toISOString(),
    listings: source.federatedListings.map(federatedListingToApi),
  }));
}

export async function listFederatedListings() {
  const listings = await prisma.federatedListing.findMany({
    where: {
      status: "ACTIVE",
    },
    orderBy: [
      {
        createdAt: "desc",
      },
      {
        id: "desc",
      },
    ],
  });

  return listings.map(federatedListingToApi);
}

export async function getFederatedListingById(id: string) {
  const listing = await prisma.federatedListing.findUnique({
    where: {
      id,
    },
  });

  if (!listing) {
    return null;
  }

  return federatedListingToApi(listing);
}

export async function getFederatedListingRecordById(id: string) {
  return prisma.federatedListing.findUnique({
    where: {
      id,
    },
  });
}

export async function markTrackedInstanceFollowAccepted(remoteActorId: string) {
  await prisma.federationTrackedInstance.updateMany({
    where: {
      actorId: normalizeUrlish(remoteActorId),
    },
    data: {
      followStatus: "ACCEPTED",
      followError: null,
      lastFollowAcceptedAt: new Date(),
    },
  });
}
