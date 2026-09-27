"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function PublishToggle({ isPublic, handle }: { isPublic: boolean; handle: string | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function setPublic(next: boolean) {
    setError(null);
    const res = await fetch("/api/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isPublic: next }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to update publish status.");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium">Public leaderboard visibility</h2>
          <p className="text-sm text-neutral-500">
            {isPublic
              ? "You're on the public leaderboard. Individual projects still need their own visibility turned on."
              : "You're private. Nothing about you appears on the leaderboard or has a public profile until you publish."}
          </p>
        </div>
        <button
          onClick={() => setPublic(!isPublic)}
          disabled={pending}
          className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${
            isPublic
              ? "border border-neutral-300 dark:border-neutral-700"
              : "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          }`}
        >
          {isPublic ? "Unpublish" : "Publish"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {isPublic && handle && (
        <p className="mt-2 text-sm">
          Preview: <a href={`/u/${handle}`} className="underline" target="_blank" rel="noreferrer">
            /u/{handle}
          </a>
        </p>
      )}
    </div>
  );
}
