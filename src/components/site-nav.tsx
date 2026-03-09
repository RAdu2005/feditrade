import Link from "next/link";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/sign-out-button";

export async function SiteNav() {
  const session = await auth();
  return (
    <header className="border-b border-slate-200">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold">
          Fedimarket
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/">Listings</Link>
          {session?.user ? <Link href="/listings/new">Create listing</Link> : null}
          {session?.user?.role === "ADMIN" ? <Link href="/admin">Admin</Link> : null}
          {session?.user ? (
            <>
              <Link
                href={`https://${session.user.mastodonDomain}/@${session.user.mastodonUsername}`}
                target="_blank"
                className="inline-flex items-center gap-2"
              >
                {session.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.image}
                    alt={session.user.mastodonUsername}
                    className="h-6 w-6 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <span className="h-6 w-6 rounded-full border border-slate-200 bg-slate-100" />
                )}
                <span>@{session.user.mastodonUsername}</span>
              </Link>
              <SignOutButton />
            </>
          ) : (
            <Link className="rounded bg-slate-900 px-3 py-1.5 text-white" href="/auth/signin">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
