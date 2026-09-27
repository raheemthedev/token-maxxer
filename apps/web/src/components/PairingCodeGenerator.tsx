"use client";

import { useState } from "react";

export function PairingCodeGenerator({ serverUrl }: { serverUrl: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    const res = await fetch("/api/collector/pair-code", { method: "POST" });
    setLoading(false);
    if (!res.ok) return;
    const data = await res.json();
    setCode(data.code);
    setExpiresAt(data.expiresAt);
  }

  return (
    <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="mb-2 font-medium">Pair a new collector</h2>
      <p className="mb-3 text-sm text-neutral-500">
        Run the collector on the machine you use Claude Code / OpenCode on, then pair it with a
        one-time code.
      </p>
      {code ? (
        <div className="space-y-2">
          <pre className="overflow-x-auto rounded-md bg-neutral-100 p-3 text-sm dark:bg-neutral-900">
            {`npm run collector -- pair --server ${serverUrl} --code ${code}`}
          </pre>
          <p className="text-xs text-neutral-500">
            Expires {expiresAt ? new Date(expiresAt).toLocaleTimeString() : ""}. One-time use.
          </p>
        </div>
      ) : (
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {loading ? "Generating…" : "Generate pairing code"}
        </button>
      )}
    </div>
  );
}
