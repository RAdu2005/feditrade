"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  MASS_CIRCULATION_CURRENCY_CODE_SET,
  MASS_CIRCULATION_CURRENCY_OPTIONS,
  PRIORITY_CURRENCY_CODES,
} from "@/lib/currencies";
import {
  COUNTRY_CODE_BY_NAME,
  COUNTRY_OPTION_BY_CODE,
  COUNTRY_TERRITORY_CODE_SET,
  COUNTRY_TERRITORY_OPTIONS,
  PRIORITY_COUNTRY_CODES,
} from "@/lib/regions";

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

function parseLocation(location: string | null | undefined) {
  if (!location) {
    return {
      countryCode: "",
      city: "",
    };
  }

  const normalized = location.trim();
  if (!normalized) {
    return {
      countryCode: "",
      city: "",
    };
  }

  const separatorIndex = normalized.lastIndexOf(",");
  if (separatorIndex > -1) {
    const cityPart = normalized.slice(0, separatorIndex).trim();
    const countryPart = normalized.slice(separatorIndex + 1).trim().toLowerCase();
    const countryCode = COUNTRY_CODE_BY_NAME.get(countryPart);

    if (countryCode) {
      return {
        countryCode,
        city: cityPart,
      };
    }
  }

  const asCountryCode = COUNTRY_CODE_BY_NAME.get(normalized.toLowerCase());
  if (asCountryCode) {
    return {
      countryCode: asCountryCode,
      city: "",
    };
  }

  return {
    countryCode: "",
    city: normalized,
  };
}

async function uploadImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const uploadResponse = await fetch("/api/uploads", {
    method: "POST",
    body: formData,
  });

  if (!uploadResponse.ok) {
    throw new Error("Failed to upload image.");
  }

  const uploaded = (await uploadResponse.json()) as {
    key: string;
  };

  return uploaded.key;
}

export function ListingForm({ mode, listingId, initial }: Props) {
  const router = useRouter();
  const initialLocation = parseLocation(initial?.location);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priceAmount, setPriceAmount] = useState(initial?.priceAmount ?? "");
  const [priceCurrency, setPriceCurrency] = useState(initial?.priceCurrency ?? "EUR");
  const [locationCountry, setLocationCountry] = useState(initialLocation.countryCode);
  const [locationCity, setLocationCity] = useState(initialLocation.city);
  const [category, setCategory] = useState(initial?.category ?? "");
  const [status, setStatus] = useState<"ACTIVE" | "SOLD" | "REMOVED">("ACTIVE");
  const [imageKeys, setImageKeys] = useState<string[]>(initial?.imageKeys ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submitLabel = useMemo(() => (mode === "create" ? "Create listing" : "Save changes"), [mode]);
  const pinnedCurrencySet = useMemo(() => new Set<string>(PRIORITY_CURRENCY_CODES), []);
  const pinnedCurrencyOptions = useMemo(
    () => MASS_CIRCULATION_CURRENCY_OPTIONS.filter((option) => pinnedCurrencySet.has(option.code)),
    [pinnedCurrencySet],
  );
  const otherCurrencyOptions = useMemo(
    () => MASS_CIRCULATION_CURRENCY_OPTIONS.filter((option) => !pinnedCurrencySet.has(option.code)),
    [pinnedCurrencySet],
  );
  const hasUnknownSelectedCurrency = useMemo(
    () => !!priceCurrency && !MASS_CIRCULATION_CURRENCY_CODE_SET.has(priceCurrency),
    [priceCurrency],
  );
  const pinnedCountrySet = useMemo(() => new Set<string>(PRIORITY_COUNTRY_CODES), []);
  const pinnedCountryOptions = useMemo(
    () => COUNTRY_TERRITORY_OPTIONS.filter((option) => pinnedCountrySet.has(option.code)),
    [pinnedCountrySet],
  );
  const otherCountryOptions = useMemo(
    () => COUNTRY_TERRITORY_OPTIONS.filter((option) => !pinnedCountrySet.has(option.code)),
    [pinnedCountrySet],
  );
  const hasUnknownSelectedCountry = useMemo(
    () => !!locationCountry && !COUNTRY_TERRITORY_CODE_SET.has(locationCountry),
    [locationCountry],
  );

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

    const normalizedCity = locationCity.trim();
    const selectedCountry = locationCountry
      ? COUNTRY_OPTION_BY_CODE.get(locationCountry)?.name ?? null
      : null;
    const location =
      normalizedCity && selectedCountry
        ? `${normalizedCity}, ${selectedCountry}`
        : normalizedCity || selectedCountry || null;

    const payload = {
      title,
      description,
      priceAmount: priceAmount ? Number(priceAmount) : null,
      priceCurrency: priceCurrency || null,
      location,
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
          <select
            id="priceCurrency"
            value={priceCurrency ?? ""}
            onChange={(event) => setPriceCurrency(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
          >
            <option value="">No currency</option>
            {hasUnknownSelectedCurrency ? (
              <option value={priceCurrency ?? ""}>{priceCurrency} - Unknown (legacy)</option>
            ) : null}
            {pinnedCurrencyOptions.map((option) => (
              <option key={`pinned-${option.code}`} value={option.code}>
                {option.label}
              </option>
            ))}
            <option disabled>--------------------</option>
            {otherCurrencyOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="locationCountry">
            Country / territory
          </label>
          <select
            id="locationCountry"
            value={locationCountry}
            onChange={(event) => setLocationCountry(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
          >
            <option value="">No country</option>
            {hasUnknownSelectedCountry ? (
              <option value={locationCountry}>{locationCountry} - Unknown (legacy)</option>
            ) : null}
            {pinnedCountryOptions.map((option) => (
              <option key={`pinned-country-${option.code}`} value={option.code}>
                {option.label}
              </option>
            ))}
            <option disabled>--------------------</option>
            {otherCountryOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="locationCity">
            City
          </label>
          <input
            id="locationCity"
            value={locationCity}
            onChange={(event) => setLocationCity(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
            placeholder="City"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
