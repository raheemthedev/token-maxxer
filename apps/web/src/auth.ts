import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { assignHandle } from "@/lib/handle";

export const isGithubConfigured = Boolean(
  process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET,
);
export const isEmailConfigured = Boolean(process.env.EMAIL_SERVER && process.env.EMAIL_FROM);
export const isDevEmail = process.env.NODE_ENV === "development" && !isEmailConfigured;

const providers = [];

if (isGithubConfigured) {
  providers.push(
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      // Deliberately the default read-only profile scope — never `repo`. Signing in must never
      // grant this app access to private repositories.
      authorization: { params: { scope: "read:user user:email" } },
    }),
  );
}

// Production offers email only with a configured SMTP transport. Development alone can
// print a magic link locally so new contributors can test sign-in without a mail account.
if (isEmailConfigured || isDevEmail) providers.push(
  Nodemailer({
    // Auth.js validates `server` eagerly even though our sendVerificationRequest below never
    // uses it in dev mode — a placeholder keeps that validation happy without pretending to be
    // a real SMTP config.
    server: isEmailConfigured ? process.env.EMAIL_SERVER : "smtp://unconfigured:0",
    from: process.env.EMAIL_FROM || "noreply@token-maxxer.local",
    async sendVerificationRequest({ identifier, url }) {
      if (!isEmailConfigured) {
        console.log(
          `\n[token-maxxer] Email sign-in is not configured (EMAIL_SERVER/EMAIL_FROM unset).\n` +
            `[token-maxxer] Dev magic link for ${identifier}:\n[token-maxxer] ${url}\n`,
        );
        return;
      }
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport(process.env.EMAIL_SERVER);
      await transport.sendMail({
        to: identifier,
        from: process.env.EMAIL_FROM,
        subject: "Sign in to Token Maxxer",
        text: `Sign in to Token Maxxer: ${url}`,
        html: `<p><a href="${url}">Sign in to Token Maxxer</a></p>`,
      });
    },
  }),
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  trustHost: process.env.NODE_ENV === "development" || process.env.VERCEL === "1" || process.env.AUTH_TRUST_HOST === "true",
  secret: process.env.AUTH_SECRET || (process.env.NODE_ENV === "development" ? "dev-only-insecure-secret-do-not-use-in-production" : undefined),
  providers,
  pages: {
    signIn: "/sign-in",
    verifyRequest: "/sign-in/verify-request",
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      await assignHandle(user.id, user.name || user.email || "builder");
    },
  },
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { handle: true },
      });
      session.user.handle = dbUser?.handle ?? null;
      return session;
    },
  },
});
