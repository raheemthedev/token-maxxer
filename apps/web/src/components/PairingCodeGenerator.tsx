"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";

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
    <Card>
      <h2 className="mb-2 font-medium">Pair a new collector</h2>
      <p className="mb-4 text-sm text-foreground-muted">
        Run the collector on the machine you use Claude Code / OpenCode on, then pair it with a
        one-time code.
      </p>
      {code ? (
        <div className="space-y-2">
          <pre className="overflow-x-auto rounded-xl bg-surface-muted p-3.5 font-mono text-sm">
            {`npm run collector -- pair --server ${serverUrl} --code ${code}`}
          </pre>
          <p className="text-xs text-foreground-muted">
            Expires {expiresAt ? new Date(expiresAt).toLocaleTimeString() : ""}. One-time use.
          </p>
        </div>
      ) : (
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate pairing code"}
        </button>
      )}
    </Card>
  );
}
