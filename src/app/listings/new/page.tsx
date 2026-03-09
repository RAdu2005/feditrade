import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ListingForm } from "@/components/listing-form";

export default async function NewListingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin");
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Create listing</h1>
      <p className="mt-2 text-sm text-slate-600">
        The listing will be visible publicly and federated through ActivityPub.
      </p>
      <div className="mt-8 rounded border border-slate-200 bg-white p-6">
        <ListingForm mode="create" />
      </div>
    </main>
  );
}
