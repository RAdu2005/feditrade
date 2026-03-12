import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { getMarketplaceAgreementForUser } from "@/lib/marketplace-offer-service";

type Params = {
  params: Promise<{ id: string }>;
};

export default async function AgreementDetailsPage({ params }: Params) {
  const user = await requireUser();
  if (!user) {
    redirect("/auth/signin");
  }

  const { id } = await params;
  const agreement = await getMarketplaceAgreementForUser(id, user.id);
  if (!agreement) {
    notFound();
  }

  const isCompleted = agreement.status === "COMPLETED";

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Agreement</h1>
      <p className="mt-2 text-sm text-slate-600">Track and finalize federated marketplace agreements.</p>

      <article className="mt-8 rounded border border-slate-200 bg-white p-6">
        <p className="text-sm font-medium">Listing: {agreement.proposal.listing.title}</p>
        <p className="mt-1 text-xs text-slate-600">Buyer actor: {agreement.buyerActorId}</p>
        <p className="mt-1 text-xs text-slate-600">Status: {agreement.status}</p>

        <h2 className="mt-6 text-sm font-semibold">Agreement Payload</h2>
        <pre className="mt-2 overflow-x-auto rounded bg-slate-950 p-3 text-xs text-slate-100">
          {JSON.stringify(agreement.agreementJson, null, 2)}
        </pre>

        {!isCompleted ? (
          <form className="mt-6" action={`/api/agreements/${agreement.id}/complete`} method="post">
            <button
              type="submit"
              className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
            >
              Mark completed and publish confirmation
            </button>
          </form>
        ) : null}

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
      </article>
    </main>
  );
}
