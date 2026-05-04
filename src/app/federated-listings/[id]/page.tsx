import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ListingImageGallery } from "@/components/listing-image-gallery";
import { ListingOfferForm } from "@/components/listing-offer-form";
import { getFederatedListingById } from "@/lib/federation-tracking-service";
import { listOutboundMarketplaceOffersForUserAndFederatedListing } from "@/lib/marketplace-outbound-offer-service";

type Params = {
  params: Promise<{ id: string }>;
};

export default async function FederatedListingDetailsPage({ params }: Params) {
  const { id } = await params;
  const [listing, session] = await Promise.all([getFederatedListingById(id), auth()]);
  if (!listing) {
    notFound();
  }

  const canSendOffer = !!session?.user?.id && !!listing.proposalUrl && listing.status === "ACTIVE";
  const sentOffers = canSendOffer
    ? await listOutboundMarketplaceOffersForUserAndFederatedListing(session.user.id, listing.id)
    : [];
  const listingPurposeLabel = listing.proposalPurpose === "offer" ? "SELLING" : "BUYING";
  const listingPurposeClass = listing.proposalPurpose === "offer" ? "bg-emerald-600" : "bg-red-800";
  const ownerLabel = listing.owner.username.startsWith("@")
    ? listing.owner.username
    : `@${listing.owner.username}`;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <article className="rounded border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{listing.title}</h1>
          <span
            className={`inline-flex rounded-md px-2.5 py-1 text-xs font-extrabold tracking-wide text-white ${listingPurposeClass}`}
          >
            {listingPurposeLabel}
          </span>
        </div>
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
            <span>
              <a className="underline" href={listing.owner.actorUri} target="_blank" rel="noreferrer">
                {ownerLabel}
              </a>
              {listing.owner.activityPubActorUri &&
              listing.owner.activityPubActorUri !== listing.owner.actorUri ? (
                <>
                  {" "}
                  (
                  <a
                    className="underline"
                    href={listing.owner.activityPubActorUri}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Actor
                  </a>
                  )
                </>
              ) : null}
            </span>
          </div>
          {listing.location ? <p className="mt-1">Location: {listing.location}</p> : null}
          {listing.category ? <p className="mt-1">Category: {listing.category}</p> : null}
          <p className="mt-1">Source: {listing.originDomain}</p>
          <p className="mt-1">Status: {listing.status}</p>
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
          {listing.canonicalUrl ? (
            <p className="mt-1">
              Canonical listing:{" "}
              <a className="underline" href={listing.canonicalUrl} target="_blank" rel="noreferrer">
                {listing.canonicalUrl}
              </a>
            </p>
          ) : null}
        </div>

        {canSendOffer ? (
          <ListingOfferForm
            listingId={listing.id}
            listingViewHref={`/federated-listings/${listing.id}`}
            offerEndpoint={`/api/federated-listings/${listing.id}/offers`}
            listingCurrency={listing.priceCurrency}
            listingUnitCode={listing.unitCode}
            sentOffers={sentOffers.map((offer) => ({
              id: offer.id,
              status: offer.status,
              targetActorId: offer.targetActorId,
              agreementJson: offer.agreementJson,
              responseJson: offer.responseJson,
              sentAt: offer.sentAt.toISOString(),
              respondedAt: offer.respondedAt?.toISOString() ?? null,
            }))}
          />
        ) : null}

        <div className="mt-8">
          <Link className="text-sm underline" href="/offers/sent">
            View all sent offers
          </Link>
        </div>
      </article>
    </main>
  );
}
