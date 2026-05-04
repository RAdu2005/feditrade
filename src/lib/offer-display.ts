type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function asNonEmptyString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toDisplayNumber(value: unknown, maximumFractionDigits: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString(undefined, {
      maximumFractionDigits,
    });
  }

  const asString = asNonEmptyString(value);
  if (!asString) {
    return null;
  }

  const parsed = Number(asString);
  if (Number.isFinite(parsed)) {
    return parsed.toLocaleString(undefined, {
      maximumFractionDigits,
    });
  }

  return asString;
}

function parseIsoCurrency(value: unknown) {
  const currency = asNonEmptyString(value)?.toUpperCase();
  if (!currency) {
    return null;
  }

  if (/^[A-Z]{3}$/.test(currency)) {
    return currency;
  }

  const urnMatch = currency.match(/:([A-Z]{3})$/);
  return urnMatch?.[1] ?? null;
}

function normalizeActorUri(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function readActorId(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = normalizeActorUri(value);
    return normalized.length > 0 ? normalized : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = (value as { id?: unknown }).id;
  if (typeof candidate !== "string") {
    return null;
  }

  const normalized = normalizeActorUri(candidate);
  return normalized.length > 0 ? normalized : null;
}

export function actorLabelFromUri(uri: string) {
  try {
    const parsed = new URL(uri);
    const domain = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, "");
    const parts = path.split("/").filter(Boolean);

    let username: string | null = null;
    if (parts.length >= 1 && parts[0]?.startsWith("@")) {
      username = parts[0].slice(1);
    } else if (parts.length >= 2 && parts[0]?.toLowerCase() === "users") {
      username = parts[1] ?? null;
    } else if (parts.length >= 3 && parts[0]?.toLowerCase() === "ap" && parts[1]?.toLowerCase() === "actor") {
      username = parts[2] ?? null;
    } else if (parts.length > 0) {
      username = parts[parts.length - 1] ?? null;
    }

    if (!username) {
      return uri;
    }

    const normalizedUsername = username.replace(/^@+/, "");
    return `@${normalizedUsername}@${domain}`;
  } catch {
    return uri;
  }
}

export function domainLabelFromUri(uri: string) {
  try {
    const parsed = new URL(uri);
    return `@${parsed.hostname.toLowerCase()}`;
  } catch {
    return "@unknown";
  }
}

export function listingUrlFromProposalId(proposalId: string) {
  try {
    const parsed = new URL(proposalId);
    const cleanedPath = parsed.pathname.replace(/\/+$/, "");
    const listingMatch = cleanedPath.match(/\/ap\/proposals\/([^/]+)$/);
    if (!listingMatch?.[1]) {
      return null;
    }

    return `${parsed.origin}/listings/${listingMatch[1]}`;
  } catch {
    return null;
  }
}

export function extractOfferSenderActorId(agreementJson: unknown, fallbackActorId: string) {
  const agreement = asRecord(agreementJson);
  if (!agreement) {
    return fallbackActorId;
  }

  return (
    readActorId(agreement.buyer) ??
    readActorId(agreement.sender) ??
    readActorId(agreement.actor) ??
    readActorId(agreement.attributedTo) ??
    fallbackActorId
  );
}

export function extractOfferCounterpartyActorId(agreementJson: unknown, fallbackActorId: string) {
  const agreement = asRecord(agreementJson);
  if (!agreement) {
    return fallbackActorId;
  }

  return (
    readActorId(agreement.receiver) ??
    readActorId(agreement.seller) ??
    readActorId(agreement.provider) ??
    fallbackActorId
  );
}

export function extractOfferReadableSummary(agreementJson: unknown) {
  const agreement = asRecord(agreementJson);
  if (!agreement) {
    return {
      note: null,
      quantityText: null,
      priceText: null,
    };
  }

  const note = asNonEmptyString(agreement.note);

  const resourceQuantity = asRecord(agreement.resourceQuantity);
  const quantityValue = toDisplayNumber(resourceQuantity?.hasNumericalValue, 4);
  const quantityUnit = asNonEmptyString(resourceQuantity?.hasUnit)?.toUpperCase() ?? null;
  const quantityText = quantityValue ? `${quantityValue}${quantityUnit ? ` ${quantityUnit}` : ""}` : null;

  const reciprocal = asRecord(agreement.reciprocal);
  const reciprocalResourceQuantity = asRecord(reciprocal?.resourceQuantity);
  const amountValue = toDisplayNumber(reciprocalResourceQuantity?.hasNumericalValue, 2);
  const amountCurrency =
    parseIsoCurrency(reciprocalResourceQuantity?.hasUnit) ??
    parseIsoCurrency(reciprocal?.hasUnit) ??
    parseIsoCurrency(reciprocal?.resourceConformsTo) ??
    null;
  const priceText = amountValue ? `${amountValue}${amountCurrency ? ` ${amountCurrency}` : ""}` : null;

  return {
    note,
    quantityText,
    priceText,
  };
}

export function extractRejectReason(responseJson: unknown) {
  const response = asRecord(responseJson);
  const result = response ? asRecord(response.result) : null;
  const reason = result ? asNonEmptyString(result.reason) : null;
  return reason ?? null;
}

export function formatLocalDateTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "";
  }

  const dateLabel = date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeLabel = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${dateLabel} ${timeLabel}`;
}
