"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ReceivedOffer = {
  id: string;
  remoteActorId: string;
  status: "RECEIVED" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  receivedAt: string;
  agreementId: string | null;
};

type Props = {
  listingStatus: "ACTIVE" | "SOLD" | "REMOVED";
  offers: ReceivedOffer[];
};

export function ListingReceivedOffersPanel({ listingStatus, offers }: Props) {
  const router = useRouter();
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(offerId: string, action: "accept" | "reject") {
    setBusyOfferId(offerId);
    setError(null);

    const response = await fetch(`/api/offers/${offerId}/${action}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: action === "reject" ? JSON.stringify({ reason: "Rejected by seller" }) : undefined,
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? `Failed to ${action} offer`);
      setBusyOfferId(null);
      return;
    }

    setBusyOfferId(null);
    router.refresh();
  }

  return (
    <section className="mt-8 rounded border border-slate-200 bg-slate-50 p-4">
      <h2 className="text-base font-semibold">Received offers</h2>
      {offers.length === 0 ? (
        <p className="mt-2 text-xs text-slate-600">No offers received for this listing.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {offers.map((offer) => (
            <li key={offer.id} className="rounded border border-slate-200 bg-white p-3">
              <p className="text-xs font-medium">From: {offer.remoteActorId}</p>
              <p className="mt-1 text-xs text-slate-600">Status: {offer.status}</p>
              <p className="mt-1 text-xs text-slate-600">Received: {new Date(offer.receivedAt).toLocaleString()}</p>
              {offer.agreementId ? (
                <p className="mt-1 text-xs">
                  <Link className="underline" href={`/agreements/${offer.agreementId}`}>
                    View agreement
                  </Link>
                </p>
              ) : null}
              {offer.status === "RECEIVED" && listingStatus === "ACTIVE" ? (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => act(offer.id, "accept")}
                    disabled={busyOfferId !== null}
                    className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {busyOfferId === offer.id ? "Working..." : "Accept"}
                  </button>
                  <button
                    type="button"
                    onClick={() => act(offer.id, "reject")}
                    disabled={busyOfferId !== null}
                    className="rounded bg-red-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {busyOfferId === offer.id ? "Working..." : "Reject"}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {error ? <p className="mt-3 text-xs text-red-700">{error}</p> : null}
    </section>
  );
}
