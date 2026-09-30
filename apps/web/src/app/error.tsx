"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="text-5xl">⚠️</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-foreground-muted">
        That didn&apos;t load. It&apos;s usually temporary — try again, and if it keeps happening your data is safe.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground shadow-sm transition-opacity hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
