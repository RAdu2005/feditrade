import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { DeleteListingButton } from "@/components/delete-listing-button";
import { ListingOfferForm } from "@/components/listing-offer-form";
import { ListingImageGallery } from "@/components/listing-image-gallery";
import { ListingReceivedOffersPanel } from "@/components/listing-received-offers-panel";
import { getListingById } from "@/lib/listing-service";
import { listOutboundMarketplaceOffersForUserAndListing } from "@/lib/marketplace-outbound-offer-service";
import { listMarketplaceOffersForUserAndListing } from "@/lib/marketplace-offer-service";

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
  const canSendOffer =
    !!session?.user?.id && !canManage && !!listing.proposalUrl && listing.status === "ACTIVE";
  const sentOffers = canSendOffer
    ? await listOutboundMarketplaceOffersForUserAndListing(session.user.id, listing.id)
    : [];
  const receivedOffers = canManage && session?.user?.id
    ? await listMarketplaceOffersForUserAndListing(session.user.id, listing.id)
    : [];

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

        {listing.images.length > 0 ? <ListingImageGallery images={listing.images} altBase={listing.title} /> : null}

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
          <p className="mt-1">Status: {listing.status}</p>
          <p className="mt-1">Purpose: {listing.proposalPurpose}</p>
          {listing.availableQuantity ? (
            <p className="mt-1">
              Quantity: {listing.availableQuantity}
              {listing.unitCode ? ` ${listing.unitCode}` : ""}
            </p>
          ) : null}
          {listing.proposalUrl ? (
            <p className="mt-1">
              Proposal:{" "}
              <a className="underline" href={listing.proposalUrl} target="_blank" rel="noreferrer">
                {listing.proposalUrl}
              </a>
            </p>
          ) : null}
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

        {canSendOffer ? (
          <ListingOfferForm
            listingId={listing.id}
            sentOffers={sentOffers.map((offer) => ({
              id: offer.id,
              status: offer.status,
              sentAt: offer.sentAt.toISOString(),
            }))}
          />
        ) : null}

        {canManage ? (
          <ListingReceivedOffersPanel
            listingStatus={listing.status}
            offers={receivedOffers.map((offer) => ({
              id: offer.id,
              remoteActorId: offer.remoteActorId,
              status: offer.status,
              receivedAt: offer.receivedAt.toISOString(),
              agreementId: offer.agreement?.id ?? null,
            }))}
          />
        ) : null}
      </article>
    </main>
  );
}
