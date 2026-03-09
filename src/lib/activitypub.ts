import { createHash, createSign, createVerify } from "node:crypto";
import { env } from "@/lib/env";

export const ACTIVITY_STREAMS_CONTEXT = "https://www.w3.org/ns/activitystreams";

export type ActivityPubActor = {
  "@context": string[];
  id: string;
  type: "Service";
  preferredUsername: string;
  name: string;
  inbox: string;
  outbox: string;
  followers: string;
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
  priceAmount?: string | null;
  priceCurrency?: string | null;
  category?: string | null;
  location?: string | null;
  imageUrls?: string[];
  updatedAt: Date;
}) {
  return {
    id: input.id,
    type: "Note",
    attributedTo: listingsActorId(),
    published: input.updatedAt.toISOString(),
    url: input.canonicalUrl,
    content: `<p><strong>${escapeHtml(input.title)}</strong></p><p>${escapeHtml(input.description)}</p>`,
    attachment: [
      {
        type: "PropertyValue",
        name: "seller",
        value: input.ownerActorUri,
      },
      ...(input.priceAmount && input.priceCurrency
        ? [
            {
              type: "PropertyValue",
              name: "price",
              value: `${input.priceAmount} ${input.priceCurrency}`,
            },
          ]
        : []),
      ...(input.category
        ? [
            {
              type: "PropertyValue",
              name: "category",
              value: input.category,
            },
          ]
        : []),
      ...(input.location
        ? [
            {
              type: "PropertyValue",
              name: "location",
              value: input.location,
            },
          ]
        : []),
      ...(input.imageUrls?.length
        ? input.imageUrls.map((url) => ({
            type: "Image",
            url,
          }))
        : []),
    ],
  };
}

export function createActivity(params: {
  type: "Create" | "Update" | "Delete";
  object: Record<string, unknown> | string;
  id: string;
}): ActivityPubActivity {
  return {
    "@context": [ACTIVITY_STREAMS_CONTEXT],
    id: `${baseUrl()}/ap/activities/${params.id}`,
    type: params.type,
    actor: listingsActorId(),
    to: ["https://www.w3.org/ns/activitystreams#Public"],
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
};

function parseSignatureHeader(value: string): SignatureParams | null {
  const pairs = value
    .split(",")
    .map((part) => part.trim())
    .map((part) => {
      const [k, v] = part.split("=");
      return [k, v?.replace(/^"|"$/g, "")];
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
  };
}

function digest(body: string) {
  const hash = createHash("sha256").update(body).digest("base64");
  return `SHA-256=${hash}`;
}

function signingLine(
  headerName: string,
  req: { method: string; path: string; headers: Record<string, string> },
) {
  if (headerName === "(request-target)") {
    return `(request-target): ${req.method.toLowerCase()} ${req.path}`;
  }
  return `${headerName}: ${req.headers[headerName]}`;
}

function signingString(
  headers: string[],
  req: { method: string; path: string; headers: Record<string, string> },
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
  const headersToSign = ["(request-target)", "host", "date", "digest"];

  const reqData = {
    method: params.method,
    path: `${params.url.pathname}${params.url.search}`,
    headers: {
      host,
      date,
      digest: digestHeader,
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
  const signatureHeader = params.request.headers.get("signature");
  const date = params.request.headers.get("date");
  const host = params.request.headers.get("host") ?? new URL(params.request.url).host;
  const digestHeader = params.request.headers.get("digest");

  if (!signatureHeader || !date || !digestHeader) {
    return false;
  }

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) {
    return false;
  }

  if (digest(params.body) !== digestHeader) {
    return false;
  }

  const actorResponse = await fetch(params.actorUrl, {
    headers: {
      accept: "application/activity+json, application/ld+json",
    },
  });

  if (!actorResponse.ok) {
    return false;
  }

  const actor = (await actorResponse.json()) as {
    publicKey?: { publicKeyPem?: string };
  };

  const publicKeyPem = actor.publicKey?.publicKeyPem;
  if (!publicKeyPem) {
    return false;
  }

  const requestUrl = new URL(params.request.url);
  const signingPayload = signingString(parsed.headers, {
    method: params.request.method.toLowerCase(),
    path: `${requestUrl.pathname}${requestUrl.search}`,
    headers: {
      host,
      date,
      digest: digestHeader,
    },
  });

  const verifier = createVerify("RSA-SHA256");
  verifier.update(signingPayload);
  verifier.end();

  return verifier.verify(publicKeyPem, parsed.signature, "base64");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
