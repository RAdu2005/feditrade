import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { listMarketplaceAgreementsForUser } from "@/lib/marketplace-offer-service";
import { listOutboundMarketplaceAgreementsForUser } from "@/lib/marketplace-outbound-offer-service";

export default async function AgreementsPage() {
  const user = await requireUser();
  if (!user) {
    redirect("/auth/signin");
  }

  const [sellerAgreements, buyerAgreements] = await Promise.all([
    listMarketplaceAgreementsForUser(user.id),
    listOutboundMarketplaceAgreementsForUser(user.id),
  ]);
  const hasNoAgreements = sellerAgreements.length === 0 && buyerAgreements.length === 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Agreements</h1>
      <p className="mt-2 text-sm text-slate-600">Accepted marketplace agreements as seller and buyer.</p>

      {hasNoAgreements ? (
        <p className="mt-8 rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">No agreements yet.</p>
      ) : (
        <>
          {sellerAgreements.length > 0 ? (
            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">As seller</h2>
              <ul className="mt-3 space-y-3">
                {sellerAgreements.map((agreement) => (
                  <li key={agreement.id} className="rounded border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{agreement.proposal.listing.title}</p>
                      <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium">{agreement.status}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">Buyer actor: {agreement.buyerActorId}</p>
                    <p className="mt-1 text-xs text-slate-600">Agreement ID: {agreement.id}</p>
                    <Link
                      href={`/agreements/${agreement.id}`}
                      className="mt-3 inline-flex rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Open agreement
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {buyerAgreements.length > 0 ? (
            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">As buyer</h2>
              <ul className="mt-3 space-y-3">
                {buyerAgreements.map((agreement) => (
                  <li key={agreement.id} className="rounded border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{agreement.outboundOffer.targetProposalId}</p>
                      <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium">{agreement.status}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">Seller actor: {agreement.outboundOffer.targetActorId}</p>
                    <p className="mt-1 text-xs text-slate-600">Agreement URI: {agreement.agreementId}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Confirmations: {agreement.confirmations.length}
                    </p>
                    <Link
                      href={`/agreements/buyer/${agreement.id}`}
                      className="mt-3 inline-flex rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Open agreement
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
