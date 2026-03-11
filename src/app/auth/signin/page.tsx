"use client";

import { FormEvent, useState } from "react";

const POPULAR_INSTANCES = [
  "mastodon.social",
  "mstdn.social",
  "mastodon.online",
  "mas.to",
  "hachyderm.io",
] as const;

export default function SignInPage() {
  const [selectedInstance, setSelectedInstance] = useState("");
  const [customInstance, setCustomInstance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const instance =
      selectedInstance === "__custom"
        ? customInstance.trim()
        : selectedInstance.trim();

    if (!instance) {
      setError("Please select an instance or type one manually.");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/auth/mastodon/start", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        instance,
        callbackUrl: "/",
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      redirectTo?: string;
      error?: string;
    };

    if (!response.ok || !payload.redirectTo) {
      setError(payload.error ?? "Failed to start Mastodon login.");
      setLoading(false);
      return;
    }

    window.location.assign(payload.redirectTo);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold">Sign in with Mastodon</h1>
      <p className="mt-2 text-sm text-slate-600">
        Enter your Mastodon instance domain.
      </p>
      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm font-medium" htmlFor="instance-select">
          Instance domain
        </label>
        <p className="-mt-2 text-xs text-slate-500">Select a popular instance or enter your own</p>
        <select
          id="instance-select"
          name="instance-select"
          value={selectedInstance}
          onChange={(event) => setSelectedInstance(event.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2"
          required
        >
          <option value="" className="hidden">Select a popular instance</option>
          {POPULAR_INSTANCES.map((popularInstance) => (
            <option key={popularInstance} value={popularInstance}>
              {popularInstance}
            </option>
          ))}
          <option value="__custom">Other</option>
        </select>
        {selectedInstance === "__custom" ? (
          <input
            id="instance-custom"
            name="instance-custom"
            type="text"
            value={customInstance}
            onChange={(event) => setCustomInstance(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
            placeholder="mastodon.social"
            required
          />
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Redirecting..." : "Continue"}
        </button>
      </form>
    </main>
  );
}
