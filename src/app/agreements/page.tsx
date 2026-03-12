import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { listMarketplaceAgreementsForUser } from "@/lib/marketplace-offer-service";

export default async function AgreementsPage() {
  const user = await requireUser();
  if (!user) {
    redirect("/auth/signin");
  }

  const agreements = await listMarketplaceAgreementsForUser(user.id);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Agreements</h1>
      <p className="mt-2 text-sm text-slate-600">Accepted marketplace agreements and completion status.</p>

      {agreements.length === 0 ? (
        <p className="mt-8 rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">No agreements yet.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {agreements.map((agreement) => (
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
      )}
    </main>
  );
}
