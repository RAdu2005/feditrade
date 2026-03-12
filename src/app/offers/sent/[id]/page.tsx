import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { getOutboundMarketplaceOfferForUser } from "@/lib/marketplace-outbound-offer-service";

type Params = {
  params: Promise<{ id: string }>;
};

export default async function SentOfferDetailsPage({ params }: Params) {
  const user = await requireUser();
  if (!user) {
    redirect("/auth/signin");
  }

  const { id } = await params;
  const offer = await getOutboundMarketplaceOfferForUser(id, user.id);
  if (!offer) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Sent Offer Details</h1>
      <article className="mt-8 rounded border border-slate-200 bg-white p-6">
        <p className="text-sm font-medium">Proposal: {offer.targetProposalId}</p>
        <p className="mt-1 text-xs text-slate-600">Target actor: {offer.targetActorId}</p>
        <p className="mt-1 text-xs text-slate-600">Status: {offer.status}</p>
        <p className="mt-1 text-xs text-slate-600">Activity: {offer.activityId}</p>

        <h2 className="mt-6 text-sm font-semibold">Sent Agreement Payload</h2>
        <pre className="mt-2 overflow-x-auto rounded bg-slate-950 p-3 text-xs text-slate-100">
          {JSON.stringify(offer.agreementJson, null, 2)}
        </pre>

        {offer.agreement ? (
          <>
            <h2 className="mt-6 text-sm font-semibold">Accepted Agreement</h2>
            <p className="mt-1 text-xs text-slate-600">Agreement ID: {offer.agreement.agreementId}</p>
            <p className="mt-1 text-xs text-slate-600">Status: {offer.agreement.status}</p>
            <pre className="mt-2 overflow-x-auto rounded bg-slate-950 p-3 text-xs text-slate-100">
              {JSON.stringify(offer.agreement.agreementJson, null, 2)}
            </pre>
          </>
        ) : null}

        {offer.confirmations.length > 0 ? (
          <>
            <h2 className="mt-6 text-sm font-semibold">Confirmations</h2>
            <ul className="mt-2 space-y-2">
              {offer.confirmations.map((confirmation) => (
                <li key={confirmation.id} className="rounded border border-slate-200 p-3 text-xs">
                  <p>Activity: {confirmation.activityId}</p>
                  <p>Published: {confirmation.publishedAt.toISOString()}</p>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </article>
    </main>
  );
}
