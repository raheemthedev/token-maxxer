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

// Email sign-in is always registered so the UI can render it, but when EMAIL_SERVER isn't
// configured we swap in a dev-only transport that logs the magic link to the server console
// instead of silently failing to send mail.
providers.push(
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
  secret: process.env.AUTH_SECRET || "dev-only-insecure-secret-do-not-use-in-production",
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
