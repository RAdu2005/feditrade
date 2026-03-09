import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { childLogger } from "@/lib/logger";
import { createMastodonAuthUrl } from "@/lib/mastodon";
import { mastodonStartSchema } from "@/lib/validators";

function callbackRoute() {
  return `${env.APP_BASE_URL.replace(/\/+$/, "")}/api/auth/mastodon/callback`;
}

export async function POST(request: Request) {
  const logger = childLogger({ route: "POST /api/auth/mastodon/start" });
  const payload = await request.json().catch(() => null);
  const parsed = mastodonStartSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid login request.",
      },
      { status: 400 },
    );
  }

  try {
    const authUrl = await createMastodonAuthUrl({
      instanceDomainInput: parsed.data.instance,
      redirectUri: callbackRoute(),
    });

    const response = NextResponse.json({ redirectTo: authUrl });
    if (parsed.data.callbackUrl) {
      response.cookies.set("fm_after_login", parsed.data.callbackUrl, {
        httpOnly: true,
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
        maxAge: 60 * 10,
        path: "/",
      });
    }

    return response;
  } catch (error) {
    logger.error({ err: error }, "Failed to start Mastodon OAuth flow");
    return NextResponse.json(
      {
        error: "Failed to start Mastodon login flow.",
      },
      { status: 500 },
    );
  }
}
