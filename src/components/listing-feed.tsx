"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ListingCard, type ListingCardItem } from "@/components/listing-card";

type ListingItem = ListingCardItem;

type FeedPayload = {
  items: ListingItem[];
  nextCursor: string | null;
};

type TrackedSource = {
  id: string;
  domain: string;
  followStatus: "pending" | "accepted" | "error";
  followError: string | null;
  listings: ListingItem[];
};

export function ListingFeed({
  initial,
  trackedSources,
  canTrackSources,
}: {
  initial: FeedPayload;
  trackedSources: TrackedSource[];
  canTrackSources: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial.items);
  const [nextCursor, setNextCursor] = useState<string | null>(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [trackingSource, setTrackingSource] = useState("");
  const [tracking, setTracking] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  async function loadMore() {
    if (!nextCursor || loading) {
      return;
    }

    setLoading(true);
    const response = await fetch(`/api/listings?cursor=${encodeURIComponent(nextCursor)}&limit=20`);
    const payload = (await response.json()) as FeedPayload;
    setItems((current) => [...current, ...payload.items]);
    setNextCursor(payload.nextCursor);
    setLoading(false);
  }

  async function onTrackSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const source = trackingSource.trim();
    if (!source || tracking) {
      return;
    }

    setTracking(true);
    setTrackingError(null);

    const response = await fetch("/api/federation/tracked-sources", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ source }),
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setTrackingError(payload.error ?? "Failed to track source");
      setTracking(false);
      return;
    }

    setTracking(false);
    setTrackingSource("");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {canTrackSources ? (
        <details className="rounded border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold">Track remote instance or listing</summary>
          <p className="mt-2 text-xs text-slate-600">
            Paste either a remote listing URL or the domain of another Feditrade instance.
          </p>
          <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={onTrackSource}>
            <input
              type="text"
              value={trackingSource}
              onChange={(event) => setTrackingSource(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="example.org or https://example.org/listings/abc"
              required
            />
            <button
              type="submit"
              disabled={tracking}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {tracking ? "Tracking..." : "Track source"}
            </button>
          </form>
          {trackingError ? <p className="mt-2 text-xs text-red-700">{trackingError}</p> : null}
        </details>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Native listings</h2>
        {items.length === 0 ? (
          <p className="text-sm text-slate-600">No listings yet. Be the first one!</p>
        ) : (
          <ul className="space-y-4">
            {items.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </ul>
        )}

        {nextCursor ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        ) : null}
      </section>

      <section className="space-y-4">
        {trackedSources.map((source) => (
          <details key={source.id} className="rounded border border-slate-200 bg-slate-50 p-4" open>
            <summary className="cursor-pointer text-sm font-semibold">
              {source.domain}
              <span className="ml-2 text-xs font-normal text-slate-600">({source.followStatus})</span>
            </summary>
            {source.followError ? <p className="mt-2 text-xs text-red-700">{source.followError}</p> : null}
            {source.listings.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No active listings mirrored yet.</p>
            ) : (
              <ul className="mt-3 space-y-4">
                {source.listings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </ul>
            )}
          </details>
        ))}
      </section>
    </div>
  );
}
