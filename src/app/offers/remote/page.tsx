import { redirect } from "next/navigation";
import { RemoteOfferForm } from "@/components/remote-offer-form";
import { requireUser } from "@/lib/auth-helpers";

export default async function NewRemoteOfferPage() {
  const user = await requireUser();
  if (!user) {
    redirect("/auth/signin");
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Send Federated Offer</h1>
      <p className="mt-2 text-sm text-slate-600">
        Initiate an FEP-0837 Offer(Agreement) against a remote proposal URL.
      </p>
      <div className="mt-8 rounded border border-slate-200 bg-white p-6">
        <RemoteOfferForm />
      </div>
    </main>
  );
}
