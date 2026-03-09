import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type AuthFailureReason = "UNAUTHORIZED" | "STALE_SESSION";

type UserIdentity = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  role: "USER" | "ADMIN";
  mastodonActorUri: string;
  mastodonDomain: string;
  mastodonUsername: string;
};

export type RequireUserResult = {
  user: UserIdentity | null;
  reason: AuthFailureReason | null;
};

export async function requireUserWithReason(): Promise<RequireUserResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      user: null,
      reason: "UNAUTHORIZED",
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      mastodonActorUri: true,
      mastodonDomain: true,
      mastodonUsername: true,
    },
  });

  if (!user) {
    return {
      user: null,
      reason: "STALE_SESSION",
    };
  }

  return {
    user,
    reason: null,
  };
}

export async function requireUser() {
  const result = await requireUserWithReason();
  return result.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user || user.role !== "ADMIN") {
    return null;
  }

  return user;
}
