"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RevokeCollectorButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function revoke() {
    if (!confirm("Revoke this collector? It will no longer be able to upload usage.")) return;
    setPending(true);
    await fetch(`/api/collectors/${id}`, { method: "DELETE" });
    setPending(false);
    router.refresh();
  }

  return (
    <button
      onClick={revoke}
      disabled={pending}
      className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20"
    >
      Revoke
    </button>
  );
}
