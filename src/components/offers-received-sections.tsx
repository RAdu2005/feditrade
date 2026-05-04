"use client";

import Link from "next/link";
import {
  domainLabelFromUri,
  extractOfferReadableSummary,
  formatLocalDateTime,
} from "@/lib/offer-display";

type ReceivedOfferItem = {
  id: string;
  listingId: string;
  listingTitle: string;
  remoteActorId: string;
  agreementJson: unknown;
  status: "RECEIVED" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  receivedAt: string;
  respondedAt: string | null;
  agreementId: string | null;
};

type ListingOffersGroup = {
  id: string;
  title: string;
  status: "ACTIVE" | "SOLD" | "REMOVED";
  offers: ReceivedOfferItem[];
};

function OfferCard({ offer }: { offer: ReceivedOfferItem }) {
  const summary = extractOfferReadableSummary(offer.agreementJson);
  const senderDomainLabel = domainLabelFromUri(offer.remoteActorId);

  return (
    <li className="rounded border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{offer.listingTitle}</p>
        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium">{offer.status}</span>
      </div>
      <p className="mt-2 text-xs text-slate-700">
        From: User {senderDomainLabel}
      </p>
      {summary.priceText ? <p className="mt-1 text-xs text-slate-700">Price: {summary.priceText}</p> : null}
      {summary.quantityText ? <p className="mt-1 text-xs text-slate-700">Quantity: {summary.quantityText}</p> : null}
      {summary.note ? <p className="mt-1 text-xs text-slate-700">Message: {summary.note}</p> : null}
      <p className="mt-1 text-xs text-slate-600">Received: {formatLocalDateTime(offer.receivedAt)}</p>
      {offer.respondedAt ? (
        <p className="mt-1 text-xs text-slate-600">Responded: {formatLocalDateTime(offer.respondedAt)}</p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Link
          href={`/offers/${offer.id}`}
          className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
        >
          Review offer
        </Link>
        {offer.agreementId ? (
          <Link
            href={`/agreements/${offer.agreementId}`}
            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium"
          >
            Open agreement
          </Link>
        ) : null}
      </div>
    </li>
  );
}

export function OffersReceivedSections({
  offers,
  groupedByListing,
}: {
  offers: ReceivedOfferItem[];
  groupedByListing: ListingOffersGroup[];
}) {
  return (
    <>
      <section className="mt-8">
        <h2 className="text-lg font-semibold">All received offers</h2>
        {offers.length === 0 ? (
          <p className="mt-3 rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">No offers yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {offers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Received offers by your listing</h2>
        <ul className="mt-4 space-y-3">
          {groupedByListing.map((listing) => (
            <li key={listing.id} className="rounded border border-slate-200 bg-slate-50 p-4">
              <details>
                <summary className="cursor-pointer text-sm font-semibold">
                  {listing.title}{" "}
                  <span className="text-xs font-normal text-slate-600">
                    ({listing.offers.length} offers, {listing.status})
                  </span>
                </summary>
                {listing.offers.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-600">No offers.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {listing.offers.map((offer) => (
                      <OfferCard key={offer.id} offer={offer} />
                    ))}
                  </ul>
                )}
              </details>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
