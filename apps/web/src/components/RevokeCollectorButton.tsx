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
      className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
    >
      Revoke
    </button>
  );
}
