import { redirect } from "next/navigation";
import { OffersReceivedSections } from "@/components/offers-received-sections";
import { requireUser } from "@/lib/auth-helpers";
import {
  listMarketplaceOffersForUser,
  listMarketplaceOffersGroupedByListingForUser,
} from "@/lib/marketplace-offer-service";

export default async function OffersPage() {
  const user = await requireUser();
  if (!user) {
    redirect("/auth/signin");
  }

  const [offers, groupedByListing] = await Promise.all([
    listMarketplaceOffersForUser(user.id),
    listMarketplaceOffersGroupedByListingForUser(user.id),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Remote Offers</h1>
      <p className="mt-2 text-sm text-slate-600">Offers received from federated actors for your marketplace proposals.</p>
      <OffersReceivedSections
        offers={offers.map((offer) => ({
          id: offer.id,
          listingId: offer.proposal.listing.id,
          listingTitle: offer.proposal.listing.title,
          remoteActorId: offer.remoteActorId,
          agreementJson: offer.agreementJson,
          status: offer.status,
          receivedAt: offer.receivedAt.toISOString(),
          respondedAt: offer.respondedAt?.toISOString() ?? null,
          agreementId: offer.agreement?.id ?? null,
        }))}
        groupedByListing={groupedByListing.map((listing) => ({
          id: listing.id,
          title: listing.title,
          status: listing.status,
          offers: listing.offers.map((offer) => ({
            id: offer.id,
            listingId: listing.id,
            listingTitle: listing.title,
            remoteActorId: offer.remoteActorId,
            agreementJson: offer.agreementJson,
            status: offer.status,
            receivedAt: offer.receivedAt.toISOString(),
            respondedAt: offer.respondedAt?.toISOString() ?? null,
            agreementId: offer.agreement?.id ?? null,
          })),
        }))}
      />
    </main>
  );
}
