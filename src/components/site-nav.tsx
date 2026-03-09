import Link from "next/link";
import { MobileNavMenu } from "@/components/mobile-nav-menu";
import { SignOutButton } from "@/components/sign-out-button";
import { requireUser } from "@/lib/auth-helpers";

export async function SiteNav() {
  const user = await requireUser();
  return (
    <header className="border-b border-slate-200">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold">
          Feditrade
        </Link>
        <nav className="hidden items-center gap-3 text-sm sm:flex">
          <Link href="/">Listings</Link>
          {user ? <Link href="/listings/new">Create listing</Link> : null}
          {user?.role === "ADMIN" ? <Link href="/admin">Admin</Link> : null}
          {user ? (
            <>
              <Link
                href={`https://${user.mastodonDomain}/@${user.mastodonUsername}`}
                target="_blank"
                className="inline-flex items-center gap-2"
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
                <span className="max-w-40 truncate">@{user.mastodonUsername}</span>
              </Link>
              <SignOutButton />
            </>
          ) : (
            <Link className="rounded bg-slate-900 px-3 py-1.5 text-white" href="/auth/signin">
              Sign in
            </Link>
          )}
        </nav>
        <MobileNavMenu user={user} />
      </div>
    </header>
  );
}
