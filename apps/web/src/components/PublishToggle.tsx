"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";

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
    <Card className="flex items-center justify-between gap-4">
      <div>
        <h2 className="font-medium">Public leaderboard visibility</h2>
        <p className="mt-0.5 text-sm text-foreground-muted">
          {isPublic
            ? "You're on the public leaderboard. Individual projects still need their own visibility turned on."
            : "You're private. Nothing about you appears on the leaderboard or has a public profile until you publish."}
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {isPublic && handle && (
          <p className="mt-2 text-sm">
            Preview:{" "}
            <a href={`/u/${handle}`} className="text-accent underline" target="_blank" rel="noreferrer">
              /u/{handle}
            </a>
          </p>
        )}
      </div>
      <button
        role="switch"
        aria-checked={isPublic}
        onClick={() => setPublic(!isPublic)}
        disabled={pending}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          isPublic ? "bg-accent" : "bg-surface-muted"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            isPublic ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </Card>
  );
}
