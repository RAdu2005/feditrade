"use client";

import { useRouter } from "next/navigation";

export function DeleteListingButton({ listingId }: { listingId: string }) {
  const router = useRouter();

  async function onDelete() {
    const confirmed = window.confirm("Delete this listing?");
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/listings/${listingId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      className="rounded bg-red-700 px-3 py-1.5 text-sm font-medium text-white"
    >
      Delete
    </button>
  );
}
