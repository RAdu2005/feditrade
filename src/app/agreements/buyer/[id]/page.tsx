import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { getOutboundMarketplaceAgreementForUser } from "@/lib/marketplace-outbound-offer-service";

type Params = {
  params: Promise<{ id: string }>;
};

export default async function BuyerAgreementDetailsPage({ params }: Params) {
  const user = await requireUser();
  if (!user) {
    redirect("/auth/signin");
  }

  const { id } = await params;
  const agreement = await getOutboundMarketplaceAgreementForUser(id, user.id);
  if (!agreement) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Buyer Agreement</h1>
      <p className="mt-2 text-sm text-slate-600">Agreement accepted from a seller for one of your sent offers.</p>

      <article className="mt-8 rounded border border-slate-200 bg-white p-6">
        <p className="text-sm font-medium">Target proposal: {agreement.outboundOffer.targetProposalId}</p>
        <p className="mt-1 text-xs text-slate-600">Seller actor: {agreement.outboundOffer.targetActorId}</p>
        <p className="mt-1 text-xs text-slate-600">Offer status: {agreement.outboundOffer.status}</p>
        <p className="mt-1 text-xs text-slate-600">Agreement URI: {agreement.agreementId}</p>
        <p className="mt-1 text-xs text-slate-600">Agreement status: {agreement.status}</p>

        <h2 className="mt-6 text-sm font-semibold">Agreement Payload</h2>
        <pre className="mt-2 overflow-x-auto rounded bg-slate-950 p-3 text-xs text-slate-100">
          {JSON.stringify(agreement.agreementJson, null, 2)}
        </pre>

        {agreement.confirmations.length > 0 ? (
          <div className="mt-6">
            <h3 className="text-sm font-semibold">Confirmations</h3>
            <ul className="mt-2 space-y-2">
              {agreement.confirmations.map((confirmation) => (
                <li key={confirmation.id} className="rounded border border-slate-200 p-3 text-xs">
                  <p>Activity: {confirmation.activityId}</p>
                  <p>Published: {confirmation.publishedAt.toISOString()}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Link
          href={`/offers/sent/${agreement.outboundOfferId}`}
          className="mt-6 inline-flex rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
        >
          Open sent offer details
        </Link>
      </article>
    </main>
  );
}
