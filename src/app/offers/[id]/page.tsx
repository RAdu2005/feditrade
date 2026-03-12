import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { getMarketplaceOfferForUser } from "@/lib/marketplace-offer-service";

type Params = {
  params: Promise<{ id: string }>;
};

export default async function OfferDetailsPage({ params }: Params) {
  const user = await requireUser();
  if (!user) {
    redirect("/auth/signin");
  }

  const { id } = await params;
  const offer = await getMarketplaceOfferForUser(id, user.id);
  if (!offer) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Offer Review</h1>
      <p className="mt-2 text-sm text-slate-600">Evaluate the incoming federated agreement proposal.</p>

      <article className="mt-8 rounded border border-slate-200 bg-white p-6">
        <p className="text-sm font-medium">Listing: {offer.proposal.listing.title}</p>
        <p className="mt-1 text-xs text-slate-600">Remote actor: {offer.remoteActorId}</p>
        <p className="mt-1 text-xs text-slate-600">Status: {offer.status}</p>

        <h2 className="mt-6 text-sm font-semibold">Agreement Payload</h2>
        <pre className="mt-2 overflow-x-auto rounded bg-slate-950 p-3 text-xs text-slate-100">
          {JSON.stringify(offer.agreementJson, null, 2)}
        </pre>

        {offer.status === "RECEIVED" ? (
          <div className="mt-6 flex flex-wrap gap-2">
            <form action={`/api/offers/${offer.id}/accept`} method="post">
              <button
                type="submit"
                className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white"
              >
                Accept offer
              </button>
            </form>
            <form action={`/api/offers/${offer.id}/reject`} method="post">
              <button
                type="submit"
                className="rounded bg-red-700 px-3 py-1.5 text-xs font-medium text-white"
              >
                Reject offer
              </button>
            </form>
          </div>
        ) : null}

        {offer.agreement ? (
          <div className="mt-6">
            <Link
              href={`/agreements/${offer.agreement.id}`}
              className="text-sm font-medium underline"
            >
              Open agreement details
            </Link>
          </div>
        ) : null}
      </article>
    </main>
  );
}
