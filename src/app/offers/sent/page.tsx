import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { listOutboundMarketplaceOffersForUser } from "@/lib/marketplace-outbound-offer-service";

function extractRejectReason(responseJson: unknown) {
  if (!responseJson || typeof responseJson !== "object" || Array.isArray(responseJson)) {
    return null;
  }

  const result = (responseJson as Record<string, unknown>).result;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return null;
  }

  const reason = (result as Record<string, unknown>).reason;
  return typeof reason === "string" && reason.trim().length > 0 ? reason : null;
}

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

      {offers.length === 0 ? (
        <p className="mt-8 rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">No outbound offers yet.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {offers.map((offer) => (
            <li key={offer.id} className="rounded border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{offer.targetProposalId}</p>
                <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium">{offer.status}</span>
              </div>
              <p className="mt-2 text-xs text-slate-600">Target actor: {offer.targetActorId}</p>
              <p className="mt-1 text-xs text-slate-600">Sent: {offer.sentAt.toISOString()}</p>
              {offer.respondedAt ? (
                <p className="mt-1 text-xs text-slate-600">Responded: {offer.respondedAt.toISOString()}</p>
              ) : (
                <p className="mt-1 text-xs text-amber-700">Awaiting response from seller</p>
              )}
              {offer.status === "REJECTED" ? (
                <p className="mt-1 text-xs text-red-700">
                  Reason: {extractRejectReason(offer.responseJson) ?? "No reason provided"}
                </p>
              ) : null}
              {offer.agreement ? (
                <p className="mt-1 text-xs">
                  <Link className="underline" href={`/agreements/buyer/${offer.agreement.id}`}>
                    Open accepted agreement
                  </Link>
                </p>
              ) : null}
              <div className="mt-3">
                <Link className="text-xs font-medium underline" href={`/offers/sent/${offer.id}`}>
                  View details
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
