import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

const OAUTH_SCOPES = "read";

type MastodonAccount = {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  avatar: string;
  url: string;
};

function normalizeDomain(input: string) {
  const normalized = input.trim().toLowerCase().replace(/^https?:\/\//, "");
  return normalized.replace(/\/+$/, "");
}

function randomToken(length = 32) {
  return randomBytes(length).toString("hex");
}

function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

async function registerApp(instanceDomain: string, redirectUri: string) {
  const response = await fetch(`https://${instanceDomain}/api/v1/apps`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      client_name: "Feditrade",
      redirect_uris: redirectUri,
      scopes: OAUTH_SCOPES,
      website: "https://fedimarket.example",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to register Mastodon app on ${instanceDomain}`);
  }

  const payload = (await response.json()) as {
    client_id: string;
    client_secret: string;
  };

  return payload;
}

export async function createMastodonAuthUrl(params: {
  instanceDomainInput: string;
  redirectUri: string;
}) {
  const instanceDomain = normalizeDomain(params.instanceDomainInput);

  if (!instanceDomain || !instanceDomain.includes(".")) {
    throw new Error("Invalid Mastodon instance domain.");
  }

  let client = await prisma.mastodonOAuthClient.findUnique({
    where: { domain: instanceDomain },
  });

  if (!client) {
    const registered = await registerApp(instanceDomain, params.redirectUri);
    client = await prisma.mastodonOAuthClient.create({
      data: {
        domain: instanceDomain,
        clientId: registered.client_id,
        clientSecret: registered.client_secret,
        scopes: OAUTH_SCOPES,
        redirectUri: params.redirectUri,
      },
    });
  }

  const state = randomToken(16);
  const verifier = randomToken(32);
  const challenge = pkceChallenge(verifier);

  await prisma.mastodonOAuthState.create({
    data: {
      state,
      codeVerifier: verifier,
      instanceDomain,
      redirectUri: params.redirectUri,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  const url = new URL(`https://${instanceDomain}/oauth/authorize`);
  url.searchParams.set("client_id", client.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", OAUTH_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  return url.toString();
}

export async function exchangeMastodonCode(params: {
  code: string;
  state: string;
}) {
  const stateRow = await prisma.mastodonOAuthState.findUnique({
    where: { state: params.state },
  });

  if (!stateRow || stateRow.consumedAt || stateRow.expiresAt <= new Date()) {
    throw new Error("Invalid or expired Mastodon OAuth state.");
  }

  const client = await prisma.mastodonOAuthClient.findUnique({
    where: { domain: stateRow.instanceDomain },
  });

  if (!client) {
    throw new Error("Missing Mastodon OAuth client registration.");
  }

  const tokenResponse = await fetch(`https://${stateRow.instanceDomain}/oauth/token`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code: params.code,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      redirect_uri: stateRow.redirectUri,
      code_verifier: stateRow.codeVerifier,
      scope: client.scopes,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Failed to exchange OAuth code with Mastodon.");
  }

  const tokenPayload = (await tokenResponse.json()) as {
    access_token: string;
  };

  const accountResponse = await fetch(
    `https://${stateRow.instanceDomain}/api/v1/accounts/verify_credentials`,
    {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
        accept: "application/json",
      },
    },
  );

  if (!accountResponse.ok) {
    throw new Error("Failed to fetch Mastodon account.");
  }

  const account = (await accountResponse.json()) as MastodonAccount;

  await prisma.mastodonOAuthState.update({
    where: { id: stateRow.id },
    data: { consumedAt: new Date() },
  });

  return {
    instanceDomain: stateRow.instanceDomain,
    account,
  };
}
