import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="stat-number text-7xl font-semibold text-accent">404</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Nothing here</h1>
      <p className="mt-2 text-foreground-muted">
        This page doesn&apos;t exist — or it belongs to a builder who hasn&apos;t published their profile. Profiles
        are private until their owner says otherwise.
      </p>
      <Link href="/" className="mt-6 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground shadow-sm transition-opacity hover:opacity-90">
        Back to the leaderboard
      </Link>
    </div>
  );
}
