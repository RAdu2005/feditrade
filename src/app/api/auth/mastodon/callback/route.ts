import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { exchangeMastodonCode } from "@/lib/mastodon";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/auth/signin?error=missing_oauth_params", request.url));
  }

  try {
    const result = await exchangeMastodonCode({ code, state });

    const user = await prisma.user.upsert({
      where: {
        mastodonDomain_mastodonAccountId: {
          mastodonDomain: result.instanceDomain,
          mastodonAccountId: result.account.id,
        },
      },
      update: {
        name: result.account.display_name || result.account.username,
        image: result.account.avatar,
        mastodonUsername: result.account.acct,
        mastodonActorUri: result.account.url,
        role: env.ADMIN_ACTOR_URIS.includes(result.account.url) ? "ADMIN" : undefined,
      },
      create: {
        mastodonDomain: result.instanceDomain,
        mastodonAccountId: result.account.id,
        mastodonUsername: result.account.acct,
        mastodonActorUri: result.account.url,
        name: result.account.display_name || result.account.username,
        image: result.account.avatar,
        role: env.ADMIN_ACTOR_URIS.includes(result.account.url) ? "ADMIN" : "USER",
      },
    });

    const loginToken = crypto.randomUUID();
    await prisma.session.create({
      data: {
        userId: user.id,
        token: loginToken,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    const callbackUrl = request.cookies.get("fm_after_login")?.value;
    const completeUrl = new URL(
      `/auth/complete?loginToken=${encodeURIComponent(loginToken)}${
        callbackUrl ? `&callbackUrl=${encodeURIComponent(callbackUrl)}` : ""
      }`,
      request.url,
    );

    const response = NextResponse.redirect(completeUrl);
    response.cookies.delete("fm_after_login");
    return response;
  } catch {
    return NextResponse.redirect(new URL("/auth/signin?error=oauth_failed", request.url));
  }
}
