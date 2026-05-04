"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  domainLabelFromUri,
  extractOfferReadableSummary,
  extractRejectReason,
  formatLocalDateTime,
} from "@/lib/offer-display";

type SentOffer = {
  id: string;
  status: string;
  targetActorId: string;
  agreementJson: unknown;
  responseJson: unknown;
  sentAt: string;
  respondedAt?: string | null;
};

type Props = {
  listingId: string;
  offerEndpoint?: string;
  listingCurrency: string | null;
  listingUnitCode: string | null;
  sentOffers: SentOffer[];
};

export function ListingOfferForm({
  listingId,
  offerEndpoint,
  listingCurrency,
  listingUnitCode,
  sentOffers,
}: Props) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enforcedCurrency = listingCurrency?.trim().toUpperCase() ?? "";
  const enforcedUnitCode = listingUnitCode?.trim().toUpperCase() ?? "";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const parsedQuantity = Number(quantity);
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError("Quantity is required and must be greater than zero");
      setSaving(false);
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Amount is required and must be greater than zero");
      setSaving(false);
      return;
    }
    if (!enforcedCurrency) {
      setError("Listing currency is missing");
      setSaving(false);
      return;
    }
    if (!enforcedUnitCode) {
      setError("Listing unit code is missing");
      setSaving(false);
      return;
    }

    const response = await fetch(offerEndpoint ?? `/api/listings/${listingId}/offers`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        note: note.trim() || null,
        quantity: parsedQuantity,
        unitCode: enforcedUnitCode,
        amount: parsedAmount,
        currency: enforcedCurrency,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Failed to send offer");
      setSaving(false);
      return;
    }

    setSaving(false);
    setNote("");
    setQuantity("");
    setAmount("");
    router.refresh();
  }

  return (
    <section className="mt-8 rounded border border-slate-200 bg-slate-50 p-4">
      <h2 className="text-base font-semibold">Send offer</h2>
      <p className="mt-1 text-xs text-slate-600">
        Target proposal and actor are inferred from this listing automatically.
      </p>

      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="listing-offer-quantity">
              Quantity
            </label>
            <input
              id="listing-offer-quantity"
              type="number"
              step="0.0001"
              min="0.0001"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="listing-offer-unit">
              Unit code
            </label>
            <input
              id="listing-offer-unit"
              value={enforcedUnitCode}
              readOnly
              disabled
              className="w-full rounded border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="listing-offer-amount">
              Amount
            </label>
            <input
              id="listing-offer-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="listing-offer-currency">
              Currency
            </label>
            <input
              id="listing-offer-currency"
              value={enforcedCurrency}
              readOnly
              disabled
              className="w-full rounded border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700"
              maxLength={3}
              placeholder="N/A"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium" htmlFor="listing-offer-note">
            Note (optional)
          </label>
          <textarea
            id="listing-offer-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {error ? <p className="text-xs text-red-700">{error}</p> : null}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {saving ? "Sending..." : "Send offer"}
        </button>
      </form>

      {sentOffers.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-xs font-semibold">Your latest offers for this listing</h3>
          <ul className="mt-2 space-y-3 text-xs text-slate-700">
            {sentOffers.map((offer) => (
              <li key={offer.id} className="rounded border border-slate-200 bg-white p-3">
                {(() => {
                  const summary = extractOfferReadableSummary(offer.agreementJson);
                  const targetDomainLabel = domainLabelFromUri(offer.targetActorId);
                  const rejectReason = offer.status === "REJECTED"
                    ? extractRejectReason(offer.responseJson)
                    : null;

                  return (
                    <>
                      <p className="text-xs font-medium">
                        To: User {targetDomainLabel}
                      </p>
                      {summary.priceText ? <p className="mt-1 text-slate-700">Price: {summary.priceText}</p> : null}
                      {summary.quantityText ? <p className="mt-1 text-slate-700">Quantity: {summary.quantityText}</p> : null}
                      {summary.note ? <p className="mt-1 text-slate-700">Message: {summary.note}</p> : null}
                      <p className="mt-1 text-slate-600">Status: {offer.status}</p>
                      <p className="mt-1 text-slate-600">Sent: {formatLocalDateTime(offer.sentAt)}</p>
                      {offer.respondedAt ? (
                        <p className="mt-1 text-slate-600">Responded: {formatLocalDateTime(offer.respondedAt)}</p>
                      ) : (
                        <p className="mt-1 text-amber-700">Awaiting response</p>
                      )}
                      {rejectReason ? <p className="mt-1 text-red-700">Reason: {rejectReason}</p> : null}
                    </>
                  );
                })()}
                <p className="mt-1">
                  <Link className="underline" href={`/offers/sent/${offer.id}`}>
                    Details
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
