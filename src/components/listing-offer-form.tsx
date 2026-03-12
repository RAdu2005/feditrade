"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type SentOffer = {
  id: string;
  status: string;
  sentAt: string;
  respondedAt?: string | null;
};

type Props = {
  listingId: string;
  listingCurrency: string | null;
  sentOffers: SentOffer[];
};

export function ListingOfferForm({ listingId, listingCurrency, sentOffers }: Props) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCode, setUnitCode] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enforcedCurrency = listingCurrency?.trim().toUpperCase() ?? "";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const parsedQuantity = Number(quantity);
    const parsedAmount = Number(amount);

    const response = await fetch(`/api/listings/${listingId}/offers`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        note: note.trim() || null,
        quantity: quantity ? (Number.isFinite(parsedQuantity) ? parsedQuantity : null) : null,
        unitCode: unitCode.trim() || null,
        amount: amount ? (Number.isFinite(parsedAmount) ? parsedAmount : null) : null,
        currency: enforcedCurrency || null,
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
    setUnitCode("");
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
              Quantity (optional)
            </label>
            <input
              id="listing-offer-quantity"
              type="number"
              step="0.0001"
              min="0.0001"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="listing-offer-unit">
              Unit code (optional)
            </label>
            <input
              id="listing-offer-unit"
              value={unitCode}
              onChange={(event) => setUnitCode(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="EA"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="listing-offer-amount">
              Amount (optional)
            </label>
            <input
              id="listing-offer-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="listing-offer-currency">
              Currency (fixed by listing)
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
          <ul className="mt-2 space-y-1 text-xs text-slate-700">
            {sentOffers.map((offer) => (
              <li key={offer.id} className="flex flex-wrap items-center gap-2">
                <span>
                  {offer.status} - {new Date(offer.sentAt).toLocaleString()}
                  {offer.respondedAt ? ` (responded ${new Date(offer.respondedAt).toLocaleString()})` : ""}
                </span>
                <Link className="underline" href={`/offers/sent/${offer.id}`}>
                  details
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
