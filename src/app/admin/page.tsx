import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export default async function AdminPage() {
  const user = await requireAdmin();
  if (!user) {
    redirect("/");
  }

  const [failedJobs, listings, offers, agreements] = await Promise.all([
    prisma.federationDeliveryJob.findMany({
      where: { status: "DEAD_LETTER" },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    prisma.listing.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.marketplaceOffer.findMany({
      orderBy: { receivedAt: "desc" },
      take: 30,
      include: {
        proposal: {
          include: {
            listing: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    }),
    prisma.marketplaceAgreement.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        proposal: {
          include: {
            listing: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <p className="mt-2 text-sm text-slate-600">Minimal moderation and federation controls.</p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Failed Federation Jobs</h2>
        {failedJobs.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No failed jobs.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {failedJobs.map((job) => (
              <li key={job.id} className="rounded border border-slate-200 p-4">
                <p className="text-sm font-medium">{job.targetInbox}</p>
                <p className="mt-1 text-xs text-slate-600">{job.lastError ?? "Unknown error"}</p>
                <form className="mt-3" action={`/api/admin/federation/retry/${job.id}`} method="post">
                  <button
                    className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                    type="submit"
                  >
                    Retry
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Recent Marketplace Offers</h2>
        {offers.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No remote offers yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {offers.map((offer) => (
              <li key={offer.id} className="rounded border border-slate-200 p-4">
                <p className="text-sm font-medium">{offer.proposal.listing.title}</p>
                <p className="mt-1 text-xs text-slate-600">Actor: {offer.remoteActorId}</p>
                <p className="mt-1 text-xs text-slate-600">Status: {offer.status}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Recent Marketplace Agreements</h2>
        {agreements.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No agreements yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {agreements.map((agreement) => (
              <li key={agreement.id} className="rounded border border-slate-200 p-4">
                <p className="text-sm font-medium">{agreement.proposal.listing.title}</p>
                <p className="mt-1 text-xs text-slate-600">Buyer: {agreement.buyerActorId}</p>
                <p className="mt-1 text-xs text-slate-600">Status: {agreement.status}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Recent Active Listings</h2>
        <ul className="mt-3 space-y-3">
          {listings.map((listing) => (
            <li key={listing.id} className="rounded border border-slate-200 p-4">
              <p className="font-medium">{listing.title}</p>
              <p className="mt-1 text-xs text-slate-600">{listing.id}</p>
              <form className="mt-3" action={`/api/admin/listings/${listing.id}/takedown`} method="post">
                <button
                  className="rounded bg-red-700 px-3 py-1.5 text-xs font-medium text-white"
                  type="submit"
                >
                  Take down
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
