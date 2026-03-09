"use client";

import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
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
  imageUrls?: string[];
};

type Props = {
  mode: "create" | "edit";
  listingId?: string;
  initial?: ListingDraft;
};

type FormField =
  | "title"
  | "description"
  | "priceAmount"
  | "priceCurrency"
  | "locationCountry"
  | "locationCity"
  | "categorySelection"
  | "customCategory"
  | "imageKeys";

type FormErrors = Partial<Record<FormField, string>>;

const PRESET_CATEGORIES = [
  "Cars & Bikes",
  "Homes",
  "Electronics & Appliances",
  "Fashion & Beauty",
  "Auto Parts",
  "Home & Garden",
  "Mother & Child",
  "Sports & Leisure",
  "Pets",
  "Industrial",
  "Other",
] as const;

const OTHER_CATEGORY = "Other";
const maxImages = 6;

type UploadedImage = {
  key: string;
  previewUrl: string;
};

function parseCategory(category: string | null | undefined) {
  if (!category) {
    return {
      selected: "",
      custom: "",
    };
  }

  if ((PRESET_CATEGORIES as readonly string[]).includes(category)) {
    return {
      selected: category,
      custom: "",
    };
  }

  return {
    selected: OTHER_CATEGORY,
    custom: category,
  };
}

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

  const payload = (await uploadResponse.json().catch(() => ({}))) as {
    key?: string;
    publicUrl?: string;
    error?: string;
  };

  if (!uploadResponse.ok || !payload.key) {
    throw new Error(payload.error ?? "Failed to upload image.");
  }

  return {
    key: payload.key,
    previewUrl: payload.publicUrl ?? payload.key,
  } satisfies UploadedImage;
}

function parseServerErrors(details: unknown): FormErrors {
  const fieldErrors: FormErrors = {};
  if (!details || typeof details !== "object") {
    return fieldErrors;
  }

  const record = details as {
    fieldErrors?: Record<string, string[] | undefined>;
  };
  if (!record.fieldErrors) {
    return fieldErrors;
  }

  const read = (name: string) => record.fieldErrors?.[name]?.[0];
  const locationError = read("location");
  const categoryError = read("category");

  if (read("title")) fieldErrors.title = read("title");
  if (read("description")) fieldErrors.description = read("description");
  if (read("priceAmount")) fieldErrors.priceAmount = read("priceAmount");
  if (read("priceCurrency")) fieldErrors.priceCurrency = read("priceCurrency");
  if (locationError) {
    fieldErrors.locationCountry = locationError;
    fieldErrors.locationCity = locationError;
  }
  if (categoryError) {
    fieldErrors.categorySelection = categoryError;
  }
  if (read("imageKeys")) fieldErrors.imageKeys = read("imageKeys");

  return fieldErrors;
}

export function ListingForm({ mode, listingId, initial }: Props) {
  const router = useRouter();
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const initialLocation = parseLocation(initial?.location);
  const initialCategory = parseCategory(initial?.category);
  const defaultCurrency = PRIORITY_CURRENCY_CODES[0] ?? "EUR";

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priceAmount, setPriceAmount] = useState(initial?.priceAmount ?? "");
  const [priceCurrency, setPriceCurrency] = useState(initial?.priceCurrency ?? defaultCurrency);
  const [locationCountry, setLocationCountry] = useState(initialLocation.countryCode);
  const [locationCity, setLocationCity] = useState(initialLocation.city);
  const [categorySelection, setCategorySelection] = useState(initialCategory.selected);
  const [customCategory, setCustomCategory] = useState(initialCategory.custom);
  const [status, setStatus] = useState<"ACTIVE" | "SOLD" | "REMOVED">("ACTIVE");
  const [images, setImages] = useState<UploadedImage[]>(
    (initial?.imageKeys ?? []).map((key, index) => ({
      key,
      previewUrl: initial?.imageUrls?.[index] ?? key,
    })),
  );
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageKeys = useMemo(() => images.map((image) => image.key), [images]);

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
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    if (images.length >= maxImages) {
      setErrorMessages([`You can upload up to ${maxImages} images.`]);
      input.value = "";
      return;
    }

    try {
      setUploadingImage(true);
      const uploadedImage = await uploadImage(file);
      setImages((existing) => [...existing, uploadedImage].slice(0, maxImages));
      setFieldErrors((prev) => ({ ...prev, imageKeys: undefined }));
      setErrorMessages([]);
    } catch (uploadError) {
      setErrorMessages([uploadError instanceof Error ? uploadError.message : "Image upload failed."]);
    } finally {
      setUploadingImage(false);
      input.value = "";
    }
  }

  function onRemoveImage(index: number) {
    setImages((existing) => existing.filter((_, currentIndex) => currentIndex !== index));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    setErrorMessages([]);

    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();
    const parsedPrice = Number(priceAmount);
    const normalizedCity = locationCity.trim();
    const selectedCountryName = locationCountry
      ? COUNTRY_OPTION_BY_CODE.get(locationCountry)?.name ?? null
      : null;
    const location =
      normalizedCity && selectedCountryName
        ? `${normalizedCity}, ${selectedCountryName}`
        : normalizedCity || selectedCountryName || null;
    const normalizedCustomCategory = customCategory.trim();
    const category =
      categorySelection === OTHER_CATEGORY
        ? normalizedCustomCategory || null
        : categorySelection || null;

    const nextFieldErrors: FormErrors = {};
    if (!normalizedTitle) nextFieldErrors.title = "Title is required.";
    if (!normalizedDescription) nextFieldErrors.description = "Description is required.";
    if (mode === "create" && (!Number.isFinite(parsedPrice) || parsedPrice <= 0)) {
      nextFieldErrors.priceAmount = "Price must be greater than 0.";
    }
    if (mode === "create" && !priceCurrency) {
      nextFieldErrors.priceCurrency = "Currency is required.";
    }
    if (mode === "create" && !locationCountry) {
      nextFieldErrors.locationCountry = "Country is required.";
    }
    if (mode === "create" && !normalizedCity) {
      nextFieldErrors.locationCity = "City is required.";
    }
    if (mode === "create" && !categorySelection) {
      nextFieldErrors.categorySelection = "Category is required.";
    }
    if (categorySelection === OTHER_CATEGORY && !normalizedCustomCategory) {
      nextFieldErrors.customCategory = "Custom category is required.";
    }
    if (mode === "create" && imageKeys.length === 0) {
      nextFieldErrors.imageKeys = "At least one image is required.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setSaving(false);
      return;
    }

    const basePayload = {
      title: normalizedTitle,
      description: normalizedDescription,
      priceAmount: Number.isFinite(parsedPrice) ? parsedPrice : null,
      priceCurrency: priceCurrency || null,
      location,
      category,
      imageKeys,
    };

    const isCreate = mode === "create";
    const payload = isCreate ? basePayload : { ...basePayload, status };

    const response = await fetch(isCreate ? "/api/listings" : `/api/listings/${listingId}`, {
      method: isCreate ? "POST" : "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responsePayload = (await response.json().catch(() => ({}))) as {
      id?: string;
      error?: string;
      details?: unknown;
    };

    if (!response.ok || !responsePayload.id) {
      setFieldErrors(parseServerErrors(responsePayload.details));
      setErrorMessages([responsePayload.error ?? "Failed to save listing."]);
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
          required={mode === "create"}
        />
        {fieldErrors.title ? <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p> : null}
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
          required={mode === "create"}
        />
        {fieldErrors.description ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.description}</p>
        ) : null}
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
            min="0.01"
            value={priceAmount}
            onChange={(event) => setPriceAmount(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
            required={mode === "create"}
          />
          {fieldErrors.priceAmount ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.priceAmount}</p>
          ) : null}
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
            required={mode === "create"}
          >
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
          {fieldErrors.priceCurrency ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.priceCurrency}</p>
          ) : null}
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
            required={mode === "create"}
          >
            <option value="" disabled>
              Select country / territory
            </option>
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
          {fieldErrors.locationCountry ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.locationCountry}</p>
          ) : null}
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
            required={mode === "create"}
            maxLength={120}
          />
          {fieldErrors.locationCity ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.locationCity}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="category">
            Category
          </label>
          <select
            id="category"
            value={categorySelection}
            onChange={(event) => setCategorySelection(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
            required={mode === "create"}
          >
            <option value="" disabled>
              Select category
            </option>
            {PRESET_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          {fieldErrors.categorySelection ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.categorySelection}</p>
          ) : null}
        </div>
        {categorySelection === OTHER_CATEGORY ? (
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="customCategory">
              Custom category
            </label>
            <input
              id="customCategory"
              value={customCategory}
              onChange={(event) => setCustomCategory(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2"
              placeholder="Enter custom category"
              maxLength={60}
              required={mode === "create"}
            />
            {fieldErrors.customCategory ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.customCategory}</p>
            ) : null}
          </div>
        ) : null}
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
        <label className="mb-2 block text-sm font-medium" htmlFor="imageUpload">
          Images
        </label>
        <input
          ref={imageInputRef}
          id="imageUpload"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onFileChange}
          className="sr-only"
        />
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          disabled={uploadingImage || imageKeys.length >= maxImages}
          className="inline-flex h-12 w-12 items-center justify-center rounded border border-slate-300 text-2xl text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Add image"
          title="Add image"
        >
          +
        </button>
        <p className="mt-2 text-xs text-slate-600">
          {uploadingImage
            ? "Uploading image..."
            : `${imageKeys.length}/${maxImages} image(s) attached.`}
        </p>
        {images.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {images.map((image, index) => (
              <div
                key={`${image.key}-${index}`}
                className="relative aspect-square overflow-hidden rounded border border-slate-200 bg-slate-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.previewUrl}
                  alt={`Listing image ${index + 1}`}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemoveImage(index)}
                  className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-sm text-white"
                  aria-label={`Remove image ${index + 1}`}
                  title="Remove image"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {fieldErrors.imageKeys ? <p className="mt-1 text-xs text-red-600">{fieldErrors.imageKeys}</p> : null}
      </div>

      {errorMessages.length > 0 ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessages.map((message, index) => (
            <p key={`${message}-${index}`}>{message}</p>
          ))}
        </div>
      ) : null}

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
