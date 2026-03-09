"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

type Props = {
  loginToken: string | null;
  callbackUrl: string;
};

export function CompleteAuthClient({ loginToken, callbackUrl }: Props) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      if (!loginToken) {
        setError("Missing login token.");
        return;
      }

      const result = await signIn("credentials", {
        loginToken,
        redirect: false,
      });

      if (!result || result.error) {
        setError("Failed to complete sign-in.");
        return;
      }

      window.location.assign(callbackUrl);
    }

    void run();
  }, [callbackUrl, loginToken]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
      <h1 className="text-xl font-semibold">Completing sign-in</h1>
      {error ? (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      ) : (
        <p className="mt-2 text-sm text-slate-600">Please wait...</p>
      )}
    </main>
  );
}
