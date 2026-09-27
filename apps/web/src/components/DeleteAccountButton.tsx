"use client";

import { useState } from "react";

export function DeleteAccountButton() {
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!confirm("Permanently delete your account and all collected usage? This cannot be undone.")) return;
    if (!confirm("Really sure? This deletes your collectors, projects, and every usage record.")) return;
    setPending(true);
    const res = await fetch("/api/account/delete", { method: "POST" });
    if (res.ok) {
      // Full reload (not router.push) so the layout's server-rendered session state — now
      // invalid, since the account is gone — is refetched rather than left stale.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/";
    } else {
      setPending(false);
      alert("Deletion failed. Please try again.");
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20"
    >
      Delete account and all data
    </button>
  );
}
