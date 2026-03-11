import { createHash, createSign, createVerify } from "node:crypto";
import { env } from "./env";

export const ACTIVITY_STREAMS_CONTEXT = "https://www.w3.org/ns/activitystreams";
export const ACTOR_FETCH_ACCEPT_HEADER =
  'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams", application/ld+json';

export type ActivityPubActor = {
  "@context": string[];
  id: string;
  type: "Service";
  preferredUsername: string;
  name: string;
  inbox: string;
  outbox: string;
  followers: string;
  manuallyApprovesFollowers: boolean;
  publicKey: {
    id: string;
    owner: string;
    publicKeyPem: string;
  };
};

export type ActivityPubActivity = {
  "@context": string[];
  id: string;
  type: "Create" | "Update" | "Delete";
  actor: string;
  to: string[];
  cc: string[];
  published: string;
  object: Record<string, unknown> | string;
};

export function baseUrl() {
  return env.APP_BASE_URL.replace(/\/+$/, "");
}

export function listingsActorId() {
  return `${baseUrl()}/ap/actor/${env.AP_LISTINGS_ACTOR}`;
}

export function listingsKeyId() {
  return `${listingsActorId()}#main-key`;
}

export function listingObjectId(listingId: string) {
  return `${baseUrl()}/ap/objects/${listingId}`;
}

export function listingCanonicalUrl(listingId: string) {
  return `${baseUrl()}/listings/${listingId}`;
}

export function listingsActorDocument(): ActivityPubActor {
  return {
    "@context": [ACTIVITY_STREAMS_CONTEXT, "https://w3id.org/security/v1"],
    id: listingsActorId(),
    type: "Service",
    preferredUsername: env.AP_LISTINGS_ACTOR,
    name: "Marketplace Listings",
    inbox: `${baseUrl()}/ap/inbox`,
    outbox: `${baseUrl()}/ap/outbox`,
    followers: `${baseUrl()}/ap/actor/${env.AP_LISTINGS_ACTOR}/followers`,
    manuallyApprovesFollowers: false,
    publicKey: {
      id: listingsKeyId(),
      owner: listingsActorId(),
      publicKeyPem: env.AP_PUBLIC_KEY_PEM,
    },
  };
}

export function createListingNote(input: {
  id: string;
  title: string;
  description: string;
  canonicalUrl: string;
  ownerActorUri: string;
  ownerHandle?: string | null;
  priceAmount?: string | null;
  priceCurrency?: string | null;
  category?: string | null;
  location?: string | null;
  imageAttachments?: Array<{ url: string; mediaType?: string | null }>;
  imageUrls?: string[];
  updatedAt: Date;
}) {
  const audience = defaultAudience();

  return {
    id: input.id,
    type: "Note",
    attributedTo: listingsActorId(),
    published: input.updatedAt.toISOString(),
    url: input.canonicalUrl,
    content: renderListingContent(input),
    to: audience.to,
    cc: audience.cc,
    attachment: buildListingAttachments(input),
  };
}

export function createActivity(params: {
  type: "Create" | "Update" | "Delete";
  object: Record<string, unknown> | string;
  id: string;
}): ActivityPubActivity {
  const audience = defaultAudience();

  return {
    "@context": [ACTIVITY_STREAMS_CONTEXT],
    id: `${baseUrl()}/ap/activities/${params.id}`,
    type: params.type,
    actor: listingsActorId(),
    to: audience.to,
    cc: audience.cc,
    published: new Date().toISOString(),
    object: params.object,
  };
}

export function webfingerResource() {
  return `acct:${env.AP_LISTINGS_ACTOR}@${env.AP_INSTANCE_DOMAIN}`;
}

export function webfingerResponse() {
  return {
    subject: webfingerResource(),
    links: [
      {
        rel: "self",
        type: "application/activity+json",
        href: listingsActorId(),
      },
    ],
  };
}

type SignatureParams = {
  keyId: string;
  algorithm: string;
  headers: string[];
  signature: string;
  created?: string;
  expires?: string;
};

function parseSignatureHeader(value: string): SignatureParams | null {
  const pairs = value
    .split(",")
    .map((part) => part.trim())
    .map((part): [string, string | undefined] => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex < 0) {
        return [part, undefined];
      }
      const key = part.slice(0, separatorIndex);
      const rawValue = part.slice(separatorIndex + 1);
      return [key, rawValue.replace(/^"|"$/g, "")];
    });

  const map = Object.fromEntries(pairs);
  if (!map.keyId || !map.algorithm || !map.headers || !map.signature) {
    return null;
  }

  return {
    keyId: map.keyId,
    algorithm: map.algorithm,
    headers: map.headers.split(" "),
    signature: map.signature,
    created: map.created,
    expires: map.expires,
  };
}

function digest(body: string) {
  const hash = createHash("sha256").update(body).digest("base64");
  return `SHA-256=${hash}`;
}

function signingLine(
  headerName: string,
  req: {
    method: string;
    path: string;
    headers: Record<string, string>;
    created?: string;
    expires?: string;
  },
) {
  if (headerName === "(request-target)") {
    return `(request-target): ${req.method.toLowerCase()} ${req.path}`;
  }
  if (headerName === "(created)") {
    return `(created): ${req.created ?? ""}`;
  }
  if (headerName === "(expires)") {
    return `(expires): ${req.expires ?? ""}`;
  }
  return `${headerName}: ${req.headers[headerName]}`;
}

function signingString(
  headers: string[],
  req: {
    method: string;
    path: string;
    headers: Record<string, string>;
    created?: string;
    expires?: string;
  },
) {
  return headers.map((h) => signingLine(h, req)).join("\n");
}

export function signFederatedRequest(params: {
  method: "post";
  url: URL;
  body: string;
}) {
  const date = new Date().toUTCString();
  const host = params.url.host;
  const digestHeader = digest(params.body);
  const headersToSign = ["(request-target)", "host", "date", "digest", "content-type"];

  const reqData = {
    method: params.method,
    path: `${params.url.pathname}${params.url.search}`,
    headers: {
      host,
      date,
      digest: digestHeader,
      "content-type": "application/activity+json",
    },
  };

  const signText = signingString(headersToSign, reqData);
  const signer = createSign("RSA-SHA256");
  signer.update(signText);
  signer.end();
  const signature = signer.sign(env.AP_PRIVATE_KEY_PEM, "base64");

  const signatureHeader =
    `keyId="${listingsKeyId()}",` +
    `algorithm="rsa-sha256",` +
    `headers="${headersToSign.join(" ")}",` +
    `signature="${signature}"`;

  return {
    Date: date,
    Host: host,
    Digest: digestHeader,
    Signature: signatureHeader,
    "Content-Type": "application/activity+json",
  };
}

export async function verifyIncomingSignature(params: {
  request: Request;
  body: string;
  actorUrl: string;
}) {
  const signatureHeader = getIncomingSignatureHeader(params.request);
  if (!signatureHeader) {
    return false;
  }

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) {
    return false;
  }

  const digestHeader = params.request.headers.get("digest");
  if (digestHeader && digest(params.body) !== digestHeader) {
    return false;
  }

  if (parsed.headers.includes("digest") && !digestHeader) {
    return false;
  }

  let actorResponse: Response;
  try {
    actorResponse = await fetch(params.actorUrl, {
      headers: {
        accept: ACTOR_FETCH_ACCEPT_HEADER,
      },
    });
  } catch {
    return false;
  }

  if (!actorResponse.ok) {
    return false;
  }

  let actor: {
    id?: string;
    publicKey?: { id?: string; owner?: string; publicKeyPem?: string };
  };
  try {
    actor = (await actorResponse.json()) as {
      id?: string;
      publicKey?: { id?: string; owner?: string; publicKeyPem?: string };
    };
  } catch {
    return false;
  }

  const actorId = normalizeActorId(actor.id ?? params.actorUrl);
  if (!keyIdBelongsToActor(parsed.keyId, actorId, params.actorUrl)) {
    return false;
  }

  const publicKeyPem = selectActorPublicKey(actor, parsed.keyId);
  if (!publicKeyPem) {
    return false;
  }

  const forwardedHost = params.request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestUrl = new URL(params.request.url);
  const canonicalHeaders: Record<string, string> = {};

  for (const headerName of parsed.headers) {
    if (headerName === "(request-target)") {
      continue;
    }
    if (headerName === "(created)") {
      if (!parsed.created) {
        return false;
      }
      continue;
    }
    if (headerName === "(expires)") {
      if (!parsed.expires) {
        return false;
      }
      continue;
    }
    if (headerName === "host") {
      canonicalHeaders.host =
        forwardedHost ||
        params.request.headers.get("host") ||
        requestUrl.host;
      continue;
    }

    const headerValue = params.request.headers.get(headerName);
    if (!headerValue) {
      return false;
    }
    canonicalHeaders[headerName] = headerValue;
  }

  const signingPayload = signingString(parsed.headers, {
    method: params.request.method.toLowerCase(),
    path: `${requestUrl.pathname}${requestUrl.search}`,
    headers: canonicalHeaders,
    created: parsed.created,
    expires: parsed.expires,
  });

  const verifier = createVerify("RSA-SHA256");
  verifier.update(signingPayload);
  verifier.end();

  return verifier.verify(publicKeyPem, parsed.signature, "base64");
}

function getIncomingSignatureHeader(request: Request) {
  const directSignature = request.headers.get("signature");
  if (directSignature) {
    return directSignature;
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("signature ")) {
    return authorization.slice("signature ".length).trim();
  }

  return null;
}

function renderListingContent(input: {
  title: string;
  description: string;
  canonicalUrl: string;
  ownerActorUri: string;
  ownerHandle?: string | null;
  priceAmount?: string | null;
  priceCurrency?: string | null;
  category?: string | null;
  location?: string | null;
}) {
  const sellerHandle = normalizeOwnerHandle(input.ownerHandle) ?? deriveOwnerHandle(input.ownerActorUri);
  const sellerLabel = sellerHandle ?? input.ownerActorUri;

  const lines = [
    `<p><strong>${escapeHtml(input.title)}</strong></p>`,
    `<p>${escapeHtml(input.description)}</p>`,
    `<p>Seller: ${escapeHtml(sellerLabel)} (<a href="${escapeHtml(input.ownerActorUri)}">Link</a>)</p>`,
    ...(input.priceAmount && input.priceCurrency
      ? [`<p>Price: ${escapeHtml(input.priceAmount)} ${escapeHtml(input.priceCurrency)}</p>`]
      : []),
    ...(input.category ? [`<p>Category: ${escapeHtml(input.category)}</p>`] : []),
    ...(input.location ? [`<p>Location: ${escapeHtml(input.location)}</p>`] : []),
    `<p><a href="${escapeHtml(input.canonicalUrl)}">${escapeHtml(input.canonicalUrl)}</a></p>`,
  ];

  return lines.join("");
}

function normalizeActorId(value: string) {
  return value.replace(/\/+$/, "");
}

export function normalizeActorReference(value: unknown) {
  if (typeof value === "string" && value.trim().length > 0) {
    return normalizeActorId(value);
  }

  if (value && typeof value === "object") {
    const actorId = (value as { id?: unknown }).id;
    if (typeof actorId === "string" && actorId.trim().length > 0) {
      return normalizeActorId(actorId);
    }
  }

  return null;
}

function normalizeKeyId(value: string) {
  const [base, fragment] = value.split("#", 2);
  return `${normalizeActorId(base)}${fragment ? `#${fragment}` : ""}`;
}

function keyIdBelongsToActor(keyId: string, ...actorIds: string[]) {
  const normalizedKeyId = normalizeKeyId(keyId);
  return actorIds
    .filter(Boolean)
    .map(normalizeActorId)
    .some((actorId) => normalizedKeyId === actorId || normalizedKeyId.startsWith(`${actorId}#`));
}

function selectActorPublicKey(
  actor: { publicKey?: { id?: string; owner?: string; publicKeyPem?: string } },
  expectedKeyId: string,
) {
  const publicKey = actor.publicKey;
  if (!publicKey?.publicKeyPem) {
    return null;
  }

  if (publicKey.id && normalizeKeyId(publicKey.id) !== normalizeKeyId(expectedKeyId)) {
    return null;
  }

  return publicKey.publicKeyPem;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function defaultAudience() {
  return {
    to: ["https://www.w3.org/ns/activitystreams#Public"],
    cc: [`${listingsActorId()}/followers`],
  };
}

function buildListingAttachments(input: {
  imageAttachments?: Array<{ url: string; mediaType?: string | null }>;
  imageUrls?: string[];
}) {
  const source =
    input.imageAttachments?.map((attachment) => ({
      url: attachment.url,
      mediaType: attachment.mediaType ?? null,
    })) ??
    input.imageUrls?.map((url) => ({
      url,
      mediaType: null,
    })) ??
    [];

  return source.map((attachment) => ({
    type: "Image",
    url: attachment.url,
    mediaType: normalizeImageMediaType(attachment.mediaType, attachment.url),
  }));
}

function normalizeImageMediaType(mediaType: string | null, url: string) {
  if (!mediaType || mediaType === "image/*") {
    return inferMediaTypeFromUrl(url);
  }

  if (mediaType === "image/jpg") {
    return "image/jpeg";
  }

  if (mediaType.startsWith("image/")) {
    return mediaType;
  }

  return inferMediaTypeFromUrl(url);
}

function inferMediaTypeFromUrl(url: string) {
  const pathname = getPathname(url).toLowerCase();
  if (pathname.endsWith(".png")) {
    return "image/png";
  }
  if (pathname.endsWith(".webp")) {
    return "image/webp";
  }
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  return "image/jpeg";
}

function getPathname(url: string) {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split("?")[0] ?? url;
  }
}

function normalizeOwnerHandle(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!trimmed.startsWith("@")) {
    return `@${trimmed}`;
  }

  return trimmed;
}

function deriveOwnerHandle(actorUrl: string) {
  try {
    const parsed = new URL(actorUrl);
    const domain = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.replace(/\/+$/, "");
    const segments = pathname.split("/").filter(Boolean);

    if (segments.length === 1 && segments[0]?.startsWith("@")) {
      return `${segments[0]}@${domain}`;
    }

    if (
      segments.length >= 2 &&
      segments[0]?.toLowerCase() === "users" &&
      segments[1]
    ) {
      return `@${segments[1]}@${domain}`;
    }
  } catch {
    return null;
  }

  return null;
}
