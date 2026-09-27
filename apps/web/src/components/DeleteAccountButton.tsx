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
      className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
    >
      Delete account and all data
    </button>
  );
}
