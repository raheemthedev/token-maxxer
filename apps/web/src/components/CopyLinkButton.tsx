"use client";

import { useState } from "react";

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* clipboard unavailable — the URL is still in the address bar */
        }
      }}
      className="rounded-full border border-border-soft bg-surface px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-surface-muted"
    >
      {copied ? "Link copied ✓" : "Copy profile link"}
    </button>
  );
}
