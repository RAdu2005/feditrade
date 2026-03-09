import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { DeleteListingButton } from "@/components/delete-listing-button";
import { getListingById } from "@/lib/listing-service";

type Params = {
  params: Promise<{ id: string }>;
};

export default async function ListingDetailsPage({ params }: Params) {
  const { id } = await params;
  const [listing, session] = await Promise.all([getListingById(id), auth()]);
  if (!listing) {
    notFound();
  }

  const canManage = session?.user?.mastodonActorUri === listing.owner.actorUri;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <article className="rounded border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold">{listing.title}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {listing.priceAmount && listing.priceCurrency
            ? `${listing.priceAmount} ${listing.priceCurrency}`
            : "Price not specified"}
        </p>
        <p className="mt-4 whitespace-pre-wrap text-slate-800">{listing.description}</p>

        {listing.images.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {listing.images.map((image) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={image.id}
                src={image.url}
                alt={listing.title}
                className="h-64 w-full rounded object-cover"
              />
            ))}
          </div>
        ) : null}

        <div className="mt-6 text-sm text-slate-700">
          <div className="flex items-center gap-2">
            {listing.owner.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={listing.owner.image}
                alt={listing.owner.username}
                className="h-7 w-7 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <span className="h-7 w-7 rounded-full border border-slate-200 bg-slate-100" />
            )}
            <a className="underline" href={listing.owner.actorUri} target="_blank" rel="noreferrer">
              @{listing.owner.username}
            </a>
          </div>
          {listing.location ? <p className="mt-1">Location: {listing.location}</p> : null}
          {listing.category ? <p className="mt-1">Category: {listing.category}</p> : null}
        </div>

        {canManage ? (
          <div className="mt-8 flex items-center gap-2">
            <Link
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
              href={`/listings/${listing.id}/edit`}
            >
              Edit
            </Link>
            <DeleteListingButton listingId={listing.id} />
          </div>
        ) : null}
      </article>
    </main>
  );
}
