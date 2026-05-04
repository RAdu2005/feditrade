import Link from "next/link";
import { redirect } from "next/navigation";
import { SentOffersList } from "@/components/sent-offers-list";
import { requireUser } from "@/lib/auth-helpers";
import { listOutboundMarketplaceOffersForUser } from "@/lib/marketplace-outbound-offer-service";
import { listingUrlFromProposalId } from "@/lib/offer-display";

export default async function SentOffersPage() {
  const user = await requireUser();
  if (!user) {
    redirect("/auth/signin");
  }

  const offers = await listOutboundMarketplaceOffersForUser(user.id);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Sent Federated Offers</h1>
        <Link className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white" href="/">
          Browse listings
        </Link>
      </div>
      <SentOffersList
        offers={offers.map((offer) => ({
          id: offer.id,
          targetProposalId: offer.targetProposalId,
          targetActorId: offer.targetActorId,
          listingHref:
            offer.localListingId
              ? `/listings/${offer.localListingId}`
              : offer.federatedListingId
                ? `/federated-listings/${offer.federatedListingId}`
                : (listingUrlFromProposalId(offer.targetProposalId) ?? offer.targetProposalId),
          agreementJson: offer.agreementJson,
          responseJson: offer.responseJson,
          status: offer.status,
          sentAt: offer.sentAt.toISOString(),
          respondedAt: offer.respondedAt?.toISOString() ?? null,
          agreementId: offer.agreement?.id ?? null,
        }))}
      />
    </main>
  );
}
