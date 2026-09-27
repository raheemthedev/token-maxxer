import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { auth, signOut, isGithubConfigured, isEmailConfigured } from "@/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Token Maxxer",
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
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <header className="border-b border-neutral-200 dark:border-neutral-800">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-mono text-lg font-semibold tracking-tight">
              token<span className="text-orange-500">maxxer</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/" className="hover:underline">
                Leaderboard
              </Link>
              {session?.user ? (
                <>
                  <Link href="/dashboard" className="hover:underline">
                    Dashboard
                  </Link>
                  {session.user.handle && (
                    <Link href={`/u/${session.user.handle}`} className="hover:underline">
                      My profile
                    </Link>
                  )}
                  <form
                    action={async () => {
                      "use server";
                      await signOut();
                    }}
                  >
                    <button type="submit" className="text-neutral-500 hover:underline">
                      Sign out
                    </button>
                  </form>
                </>
              ) : authConfigured ? (
                <Link
                  href="/sign-in"
                  className="rounded-md bg-neutral-900 px-3 py-1.5 text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
                >
                  Sign in
                </Link>
              ) : (
                <span className="rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  Sign-in not configured
                </span>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-neutral-200 px-4 py-6 text-center text-xs text-neutral-500 dark:border-neutral-800">
          A friendly community leaderboard, not a fraud-proof competition. See{" "}
          <Link href="/about" className="underline">
            how counting works
          </Link>
          .
        </footer>
      </body>
    </html>
  );
}
