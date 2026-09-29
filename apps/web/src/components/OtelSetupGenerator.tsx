"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export function OtelSetupGenerator() {
  const [snippet, setSnippet] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/collector/otel-setup", { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      setError("Failed to generate a setup snippet. Try again.");
      return;
    }
    const { token, metricsEndpoint } = await res.json();
    setSnippet(
      [
        "export CLAUDE_CODE_ENABLE_TELEMETRY=1",
        "export OTEL_METRICS_EXPORTER=otlp",
        "export OTEL_EXPORTER_OTLP_PROTOCOL=http/json",
        `export OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=${metricsEndpoint}`,
        `export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer ${token}"`,
        "export OTEL_METRIC_EXPORT_INTERVAL=60000",
        "export OTEL_METRICS_INCLUDE_REPOSITORY=true",
      ].join("\n"),
    );
  }

  async function copy() {
    if (!snippet) return;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (e.g. insecure context) — the snippet is still selectable.
    }
  }

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <h2 className="font-medium">Automatic (recommended)</h2>
        <Badge tone="accent">Set once, works forever</Badge>
      </div>
      <p className="mb-4 text-sm text-foreground-muted">
        Paste this into your shell profile (<code>~/.zshrc</code>, <code>~/.bashrc</code>) once.
        Claude Code then reports usage automatically on every session — no process to keep
        running, nothing to remember to launch.
      </p>
      {snippet ? (
        <div className="space-y-2">
          <pre className="overflow-x-auto rounded-xl bg-surface-muted p-3.5 font-mono text-xs leading-relaxed">
            {snippet}
          </pre>
          <div className="flex items-center gap-3">
            <button
              onClick={copy}
              className="rounded-full border border-border-soft px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-surface-muted"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <p className="text-xs text-foreground-muted">
              This token won&apos;t be shown again — regenerate a new one if you lose it.
            </p>
          </div>
        </div>
      ) : (
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate setup snippet"}
        </button>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Card>
  );
}
