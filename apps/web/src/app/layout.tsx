import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { auth, signOut, isGithubConfigured, isEmailConfigured } from "@/auth";
import { Badge } from "@/components/ui/Badge";
import { NavLinks } from "@/components/NavLinks";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Token Maxxer — show your usage, show what you shipped", template: "%s · Token Maxxer" },
  description: "Show your usage. Show what you shipped.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  const authConfigured = isGithubConfigured || isEmailConfigured;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <header className="sticky top-0 z-10 border-b border-border-soft/70 bg-background/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3 sm:py-4">
            <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
                T
              </span>
              token<span className="text-accent">maxxer</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <NavLinks
                links={[
                  { href: "/", label: "Leaderboard" },
                  ...(session?.user
                    ? [
                        { href: "/dashboard", label: "Dashboard" },
                        ...(session.user.handle ? [{ href: `/u/${session.user.handle}`, label: "My profile" }] : []),
                      ]
                    : []),
                ]}
              />
              {session?.user ? (
                <>
                  <form
                    action={async () => {
                      "use server";
                      await signOut();
                    }}
                    className="ml-1"
                  >
                    <button
                      type="submit"
                      className="whitespace-nowrap rounded-full px-3 py-1.5 font-medium text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground"
                    >
                      Sign out
                    </button>
                  </form>
                </>
              ) : authConfigured ? (
                <Link
                  href="/sign-in"
                  className="ml-2 rounded-full bg-accent px-4 py-1.5 font-medium text-accent-foreground shadow-sm transition-opacity hover:opacity-90"
                >
                  Sign in
                </Link>
              ) : (
                <Badge tone="amber" className="ml-2">
                  Sign-in not configured
                </Badge>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10">{children}</main>
        <footer className="border-t border-border-soft px-5 py-10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-6 text-sm text-foreground-muted">
            <div>
              <p className="font-medium text-foreground">token<span className="text-accent">maxxer</span></p>
              <p className="mt-1 max-w-xs text-xs">A friendly community leaderboard — not a fraud-proof competition. Evidence labels say exactly what a number is.</p>
            </div>
            <nav className="flex gap-6 text-xs">
              <Link href="/about" className="hover:text-foreground">How counting works</Link>
              <a href="https://github.com/raheemthedev/token-maxxer" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Source ↗</a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
