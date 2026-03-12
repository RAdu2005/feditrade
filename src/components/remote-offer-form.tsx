"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function RemoteOfferForm() {
  const router = useRouter();
  const [targetProposalId, setTargetProposalId] = useState("");
  const [targetActorId, setTargetActorId] = useState("");
  const [targetInbox, setTargetInbox] = useState("");
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCode, setUnitCode] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const parsedQuantity = Number(quantity);
    const parsedAmount = Number(amount);

    const response = await fetch("/api/offers/remote", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        targetProposalId: targetProposalId.trim(),
        targetActorId: targetActorId.trim(),
        targetInbox: targetInbox.trim() || null,
        note: note.trim() || null,
        quantity: quantity ? (Number.isFinite(parsedQuantity) ? parsedQuantity : null) : null,
        unitCode: unitCode.trim() || null,
        amount: amount ? (Number.isFinite(parsedAmount) ? parsedAmount : null) : null,
        currency: currency.trim().toUpperCase() || null,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? "Failed to send offer");
      setSaving(false);
      return;
    }

    router.push("/offers/sent");
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="targetProposalId">
          Target proposal URL
        </label>
        <input
          id="targetProposalId"
          type="url"
          value={targetProposalId}
          onChange={(event) => setTargetProposalId(event.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2"
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="targetActorId">
          Target actor URL
        </label>
        <input
          id="targetActorId"
          type="url"
          value={targetActorId}
          onChange={(event) => setTargetActorId(event.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2"
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="targetInbox">
          Target inbox URL (optional)
        </label>
        <input
          id="targetInbox"
          type="url"
          value={targetInbox}
          onChange={(event) => setTargetInbox(event.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2"
          placeholder="If empty, it is discovered from actor URL"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="quantity">
            Quantity (optional)
          </label>
          <input
            id="quantity"
            type="number"
            step="0.0001"
            min="0.0001"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="unitCode">
            Unit code (optional)
          </label>
          <input
            id="unitCode"
            value={unitCode}
            onChange={(event) => setUnitCode(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
            placeholder="EA"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="amount">
            Amount (optional)
          </label>
          <input
            id="amount"
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="currency">
            Currency (optional)
          </label>
          <input
            id="currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
            placeholder="EUR"
            maxLength={3}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="note">
          Note (optional)
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="min-h-24 w-full rounded border border-slate-300 px-3 py-2"
        />
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <button
        type="submit"
        disabled={saving}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Sending..." : "Send offer"}
      </button>
    </form>
  );
}
