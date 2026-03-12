"use client";

import Link from "next/link";
import { useState } from "react";

type ListingItem = {
  id: string;
  title: string;
  description: string;
  priceAmount: string | null;
  priceCurrency: string | null;
  location: string | null;
  category: string | null;
  proposalPurpose: string | null;
  createdAt: string;
  owner: {
    actorUri: string;
    username: string;
    image: string | null;
  };
  images: {
    url: string;
  }[];
};

type FeedPayload = {
  items: ListingItem[];
  nextCursor: string | null;
};

export function ListingFeed({ initial }: { initial: FeedPayload }) {
  const [items, setItems] = useState(initial.items);
  const [nextCursor, setNextCursor] = useState<string | null>(initial.nextCursor);
  const [loading, setLoading] = useState(false);

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

  if (items.length === 0) {
    return <p className="text-sm text-slate-600">No listings yet. Be the first one!</p>;
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-4">
        {items.map((listing) => {
          const isSelling = listing.proposalPurpose !== "request";
          return (
            <li key={listing.id} className="rounded border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                {listing.images[0] ? (
                  <div className="h-32 w-full overflow-hidden rounded border border-slate-200 bg-slate-50 sm:w-40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={listing.images[0].url}
                      alt={listing.title}
                      className="h-full w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="h-32 w-full rounded bg-slate-100 sm:w-40" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link className="text-lg font-semibold hover:underline" href={`/listings/${listing.id}`}>
                      {listing.title}
                    </Link>
                    <span
                      className={`inline-flex rounded-md px-2.5 py-1 text-xs font-extrabold tracking-wide text-white ${
                        isSelling ? "bg-emerald-600" : "bg-red-800"
                      }`}
                    >
                      {isSelling ? "SELLING" : "BUYING"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{listing.description}</p>
                  <p className="mt-2 text-sm">
                    {listing.priceAmount && listing.priceCurrency
                      ? `${listing.priceAmount} ${listing.priceCurrency}`
                      : "Price not specified"}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                    {listing.owner.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={listing.owner.image}
                        alt={listing.owner.username}
                        className="h-5 w-5 rounded-full border border-slate-200 object-cover"
                      />
                    ) : (
                      <span className="h-5 w-5 rounded-full border border-slate-200 bg-slate-100" />
                    )}
                    <a className="underline" href={listing.owner.actorUri} target="_blank" rel="noreferrer">
                      @{listing.owner.username}
                    </a>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

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
    </div>
  );
}
