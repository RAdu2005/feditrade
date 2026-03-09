"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";

type MobileNavUser = {
  image: string | null;
  role: "USER" | "ADMIN";
  mastodonDomain: string;
  mastodonUsername: string;
  mastodonActorUri: string;
};

type Props = {
  user: MobileNavUser | null;
};

export function MobileNavMenu({ user }: Props) {
  const pathname = usePathname() ?? "/";
  const [openForPath, setOpenForPath] = useState<string | null>(null);
  const open = openForPath === pathname;

  return (
    <div className="relative sm:hidden">
      <button
        type="button"
        onClick={() =>
          setOpenForPath((current) => (current === pathname ? null : pathname))
        }
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-1.5 text-sm"
      >
        {user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={user.mastodonUsername}
            className="h-5 w-5 rounded-full border border-slate-200 object-cover"
          />
        ) : null}
        Menu
      </button>

      {open ? (
        <div
          id="mobile-nav-panel"
          className="absolute right-0 top-12 z-50 w-72 rounded border border-slate-200 bg-white p-3 shadow-lg"
        >
          {user ? (
            <div className="mb-3 border-b border-slate-200 pb-3">
              <a
                href={`https://${user.mastodonDomain}/@${user.mastodonUsername}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex max-w-full items-center gap-2 text-sm"
                onClick={() => setOpenForPath(null)}
              >
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.image}
                    alt={user.mastodonUsername}
                    className="h-6 w-6 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <span className="h-6 w-6 rounded-full border border-slate-200 bg-slate-100" />
                )}
                <span className="truncate">@{user.mastodonUsername}</span>
              </a>
            </div>
          ) : null}

          <nav className="flex flex-col gap-2 text-sm">
            <Link href="/" onClick={() => setOpenForPath(null)} className="rounded px-2 py-1 hover:bg-slate-100">
              Listings
            </Link>
            {user ? (
              <Link
                href="/listings/new"
                onClick={() => setOpenForPath(null)}
                className="rounded px-2 py-1 hover:bg-slate-100"
              >
                Create listing
              </Link>
            ) : null}
            {user?.role === "ADMIN" ? (
              <Link
                href="/admin"
                onClick={() => setOpenForPath(null)}
                className="rounded px-2 py-1 hover:bg-slate-100"
              >
                Admin
              </Link>
            ) : null}
          </nav>

          <div className="mt-3 border-t border-slate-200 pt-3">
            {user ? (
              <SignOutButton />
            ) : (
              <Link
                href="/auth/signin"
                onClick={() => setOpenForPath(null)}
                className="inline-flex rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
