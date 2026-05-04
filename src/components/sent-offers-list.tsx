"use client";

import Link from "next/link";
import {
  domainLabelFromUri,
  extractOfferReadableSummary,
  extractRejectReason,
  formatLocalDateTime,
} from "@/lib/offer-display";

type SentOfferItem = {
  id: string;
  targetProposalId: string;
  targetActorId: string;
  agreementJson: unknown;
  responseJson: unknown;
  status: "SENT" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  sentAt: string;
  respondedAt: string | null;
  agreementId: string | null;
};

export function SentOffersList({ offers }: { offers: SentOfferItem[] }) {
  if (offers.length === 0) {
    return <p className="mt-8 rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">No outbound offers yet.</p>;
  }

  return (
    <ul className="mt-8 space-y-3">
      {offers.map((offer) => {
        const summary = extractOfferReadableSummary(offer.agreementJson);
        const targetDomainLabel = domainLabelFromUri(offer.targetActorId);
        const rejectReason = offer.status === "REJECTED" ? extractRejectReason(offer.responseJson) : null;

        return (
          <li key={offer.id} className="rounded border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{offer.targetProposalId}</p>
              <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium">{offer.status}</span>
            </div>
            <p className="mt-2 text-xs text-slate-700">
              To: User {targetDomainLabel}
            </p>
            {summary.priceText ? <p className="mt-1 text-xs text-slate-700">Price: {summary.priceText}</p> : null}
            {summary.quantityText ? <p className="mt-1 text-xs text-slate-700">Quantity: {summary.quantityText}</p> : null}
            {summary.note ? <p className="mt-1 text-xs text-slate-700">Message: {summary.note}</p> : null}
            <p className="mt-1 text-xs text-slate-600">Sent: {formatLocalDateTime(offer.sentAt)}</p>
            {offer.respondedAt ? (
              <p className="mt-1 text-xs text-slate-600">Responded: {formatLocalDateTime(offer.respondedAt)}</p>
            ) : (
              <p className="mt-1 text-xs text-amber-700">Awaiting response from seller</p>
            )}
            {rejectReason ? <p className="mt-1 text-xs text-red-700">Reason: {rejectReason}</p> : null}
            {offer.agreementId ? (
              <p className="mt-1 text-xs">
                <Link className="underline" href={`/agreements/buyer/${offer.agreementId}`}>
                  Open accepted agreement
                </Link>
              </p>
            ) : null}
            <div className="mt-3">
              <Link className="text-xs font-medium underline" href={`/offers/sent/${offer.id}`}>
                View details
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
