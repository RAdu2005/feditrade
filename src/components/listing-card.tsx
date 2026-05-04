import Link from "next/link";

export type ListingCardItem = {
  id: string;
  title: string;
  description: string;
  priceAmount: string | null;
  priceCurrency: string | null;
  proposalPurpose: string | null;
  detailHref: string;
  originDomain: string;
  owner: {
    actorUri: string;
    username: string;
    image: string | null;
    activityPubActorUri?: string | null;
  };
  images: {
    url: string;
  }[];
};

export function ListingCard({ listing }: { listing: ListingCardItem }) {
  const isSelling = listing.proposalPurpose !== "request";
  const ownerLabel = listing.owner.username.startsWith("@")
    ? listing.owner.username
    : `@${listing.owner.username}`;

  return (
    <li className="rounded border border-slate-200 bg-white p-4">
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
            <Link className="text-lg font-semibold hover:underline" href={listing.detailHref}>
              {listing.title}
            </Link>
            <span
              className={`inline-flex rounded-md px-2.5 py-1 text-xs font-extrabold tracking-wide text-white ${
                isSelling ? "bg-emerald-600" : "bg-red-800"
              }`}
            >
              {isSelling ? "SELLING" : "BUYING"}
            </span>
            <span className="inline-flex rounded border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
              Source: {listing.originDomain}
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
            <span>
              <a className="underline" href={listing.owner.actorUri} target="_blank" rel="noreferrer">
                {ownerLabel}
              </a>
              {listing.owner.activityPubActorUri &&
              listing.owner.activityPubActorUri !== listing.owner.actorUri ? (
                <>
                  {" "}
                  (
                  <a className="underline" href={listing.owner.activityPubActorUri} target="_blank" rel="noreferrer">
                    Actor
                  </a>
                  )
                </>
              ) : null}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}
