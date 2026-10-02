"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const buttonClass =
  "rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50";

export function RevokeCollectorButton({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(url: string, confirmText: string) {
    if (!confirm(confirmText)) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(url, { method: "DELETE" });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "The collector could not be updated."); }
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Connection failed. Try again."); }
    finally { setPending(false); }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {error && <p role="alert" className="w-full text-xs text-red-700">{error}</p>}
      {active && (
        <button
          disabled={pending}
          onClick={() => run(`/api/collectors/${id}`, "Revoke this collector? It will no longer be able to upload usage.")}
          className={buttonClass}
        >
          Revoke
        </button>
      )}
      {!active && (
        <button
          disabled={pending}
          onClick={() =>
            run(
              `/api/collectors/${id}?remove=true`,
              "Remove this revoked collector from the list? Usage it already uploaded is kept.",
            )
          }
          className={buttonClass}
        >
          Remove
        </button>
      )}
      <button
        disabled={pending}
        onClick={() =>
          run(
            `/api/collectors/${id}?usage=delete`,
            "Revoke this collector AND permanently delete all usage it uploaded? This removes it from your totals and cannot be undone.",
          )
        }
        className={buttonClass}
      >
        Delete its usage
      </button>
    </div>
  );
}
