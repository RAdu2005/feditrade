import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "USER" | "ADMIN";
      mastodonActorUri: string;
      mastodonDomain: string;
      mastodonUsername: string;
      image?: string | null;
      name?: string | null;
      email?: string | null;
    };
  }

  interface User {
    id: string;
    role: "USER" | "ADMIN";
    mastodonActorUri: string;
    mastodonDomain: string;
    mastodonUsername: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "USER" | "ADMIN";
    mastodonActorUri?: string;
    mastodonDomain?: string;
    mastodonUsername?: string;
  }
}
