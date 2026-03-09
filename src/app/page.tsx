import { ListingFeed } from "@/components/listing-feed";
import { listPublicListings } from "@/lib/listing-service";

export default async function Home() {
  const initialFeed = await listPublicListings({ cursor: null, limit: 20 });
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-semibold">Marketplace Listings</h1>
      <p className="mt-2 text-sm text-slate-600">
        Public listings federated through ActivityPub from this instance.
      </p>
      <div className="mt-8">
        <ListingFeed initial={initialFeed} />
      </div>
    </main>
  );
}
