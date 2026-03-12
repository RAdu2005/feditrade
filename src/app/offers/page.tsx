import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { listMarketplaceOffersForUser } from "@/lib/marketplace-offer-service";

export default async function OffersPage() {
  const user = await requireUser();
  if (!user) {
    redirect("/auth/signin");
  }

  const offers = await listMarketplaceOffersForUser(user.id);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Remote Offers</h1>
      <p className="mt-2 text-sm text-slate-600">Offers received from federated actors for your marketplace proposals.</p>

      {offers.length === 0 ? (
        <p className="mt-8 rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">No offers yet.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {offers.map((offer) => (
            <li key={offer.id} className="rounded border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{offer.proposal.listing.title}</p>
                <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium">{offer.status}</span>
              </div>
              <p className="mt-2 text-xs text-slate-600">From: {offer.remoteActorId}</p>
              <p className="mt-1 text-xs text-slate-600">Received: {offer.receivedAt.toISOString()}</p>
              <div className="mt-3 flex gap-2">
                <Link
                  href={`/offers/${offer.id}`}
                  className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                >
                  Review offer
                </Link>
                {offer.agreement ? (
                  <Link
                    href={`/agreements/${offer.agreement.id}`}
                    className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium"
                  >
                    Open agreement
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
