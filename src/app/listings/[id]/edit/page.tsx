import { notFound, redirect } from "next/navigation";
import { ListingForm } from "@/components/listing-form";
import { requireUser } from "@/lib/auth-helpers";
import { getListingById } from "@/lib/listing-service";

type Params = {
  params: Promise<{ id: string }>;
};

export default async function EditListingPage({ params }: Params) {
  const { id } = await params;
  const [user, listing] = await Promise.all([requireUser(), getListingById(id)]);
  if (!user) {
    redirect("/auth/signin");
  }
  if (!listing) {
    notFound();
  }
  if (user.mastodonActorUri !== listing.owner.actorUri) {
    redirect(`/listings/${id}`);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Edit listing</h1>
      <div className="mt-8 rounded border border-slate-200 bg-white p-6">
        <ListingForm
          mode="edit"
          listingId={listing.id}
          initial={{
            title: listing.title,
            description: listing.description,
            priceAmount: listing.priceAmount,
            priceCurrency: listing.priceCurrency,
            location: listing.location,
            category: listing.category,
            imageKeys: listing.images.map((image) => image.key),
            imageUrls: listing.images.map((image) => image.url),
          }}
        />
      </div>
    </main>
  );
}
