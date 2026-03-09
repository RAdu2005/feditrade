"use client";

import { FormEvent, useState } from "react";

export default function SignInPage() {
  const [instance, setInstance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

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
        Enter your Mastodon instance domain, for example <code>mastodon.social</code>.
      </p>
      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm font-medium" htmlFor="instance">
          Instance domain
        </label>
        <input
          id="instance"
          name="instance"
          type="text"
          value={instance}
          onChange={(event) => setInstance(event.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2"
          placeholder="mastodon.social"
          required
        />
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
