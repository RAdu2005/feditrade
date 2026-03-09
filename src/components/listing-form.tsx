"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type ListingDraft = {
  title?: string;
  description?: string;
  priceAmount?: string | null;
  priceCurrency?: string | null;
  location?: string | null;
  category?: string | null;
  imageKeys?: string[];
};

type Props = {
  mode: "create" | "edit";
  listingId?: string;
  initial?: ListingDraft;
};

async function uploadImage(file: File) {
  const signResponse = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      contentType: file.type,
      sizeBytes: file.size,
    }),
  });

  if (!signResponse.ok) {
    throw new Error("Failed to sign upload.");
  }

  const signed = (await signResponse.json()) as {
    uploadUrl: string;
    key: string;
  };

  const uploadResponse = await fetch(signed.uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": file.type,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error("Failed to upload image.");
  }

  return signed.key;
}

export function ListingForm({ mode, listingId, initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priceAmount, setPriceAmount] = useState(initial?.priceAmount ?? "");
  const [priceCurrency, setPriceCurrency] = useState(initial?.priceCurrency ?? "EUR");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [status, setStatus] = useState<"ACTIVE" | "SOLD" | "REMOVED">("ACTIVE");
  const [imageKeys, setImageKeys] = useState<string[]>(initial?.imageKeys ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submitLabel = useMemo(() => (mode === "create" ? "Create listing" : "Save changes"), [mode]);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const key = await uploadImage(file);
      setImageKeys((keys) => [...keys, key].slice(0, 6));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Image upload failed.");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      title,
      description,
      priceAmount: priceAmount ? Number(priceAmount) : null,
      priceCurrency: priceCurrency || null,
      location: location || null,
      category: category || null,
      status,
      imageKeys,
    };

    const isCreate = mode === "create";
    const response = await fetch(isCreate ? "/api/listings" : `/api/listings/${listingId}`, {
      method: isCreate ? "POST" : "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responsePayload = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
    if (!response.ok || !responsePayload.id) {
      setError(responsePayload.error ?? "Failed to save listing.");
      setSaving(false);
      return;
    }

    router.push(`/listings/${responsePayload.id}`);
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="title">
          Title
        </label>
        <input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2"
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="description">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="min-h-32 w-full rounded border border-slate-300 px-3 py-2"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="priceAmount">
            Price
          </label>
          <input
            id="priceAmount"
            type="number"
            step="0.01"
            min="0"
            value={priceAmount}
            onChange={(event) => setPriceAmount(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="priceCurrency">
            Currency
          </label>
          <input
            id="priceCurrency"
            value={priceCurrency ?? ""}
            onChange={(event) => setPriceCurrency(event.target.value.toUpperCase())}
            className="w-full rounded border border-slate-300 px-3 py-2"
            maxLength={3}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="location">
            Location
          </label>
          <input
            id="location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="category">
            Category
          </label>
          <input
            id="category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
      </div>

      {mode === "edit" ? (
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(event) => setStatus(event.target.value as "ACTIVE" | "SOLD" | "REMOVED")}
            className="w-full rounded border border-slate-300 px-3 py-2"
          >
            <option value="ACTIVE">Active</option>
            <option value="SOLD">Sold</option>
            <option value="REMOVED">Removed</option>
          </select>
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="imageUpload">
          Image (optional)
        </label>
        <input
          id="imageUpload"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onFileChange}
          className="w-full rounded border border-slate-300 px-3 py-2"
        />
        {imageKeys.length > 0 ? (
          <p className="mt-2 text-xs text-slate-600">{imageKeys.length} image(s) attached.</p>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={saving}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
