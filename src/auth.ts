import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  loginToken: z.string().min(1),
});

export const authConfig = {
  secret: env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
  },
  providers: [
    CredentialsProvider({
      name: "Mastodon",
      credentials: {
        loginToken: {
          label: "Login token",
          type: "text",
        },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const now = new Date();
        const sessionToken = await prisma.session.findFirst({
          where: {
            token: parsed.data.loginToken,
            consumedAt: null,
            expiresAt: {
              gt: now,
            },
          },
          include: {
            user: true,
          },
        });

        if (!sessionToken) {
          return null;
        }

        await prisma.session.update({
          where: {
            id: sessionToken.id,
          },
          data: {
            consumedAt: now,
          },
        });

        return {
          id: sessionToken.user.id,
          email: sessionToken.user.email,
          name: sessionToken.user.name,
          image: sessionToken.user.image,
          role: sessionToken.user.role,
          mastodonActorUri: sessionToken.user.mastodonActorUri,
          mastodonDomain: sessionToken.user.mastodonDomain,
          mastodonUsername: sessionToken.user.mastodonUsername,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.mastodonActorUri = user.mastodonActorUri;
        token.mastodonDomain = user.mastodonDomain;
        token.mastodonUsername = user.mastodonUsername;
      }

      return token;
    },
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
        session.user.role = token.role ?? "USER";
        session.user.mastodonActorUri = token.mastodonActorUri ?? "";
        session.user.mastodonDomain = token.mastodonDomain ?? "";
        session.user.mastodonUsername = token.mastodonUsername ?? "";
      }

      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
} satisfies NextAuthConfig;

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
