"use client";

import { useState } from "react";

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href.split("?")[0]);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* clipboard unavailable — the URL is still in the address bar */
        }
      }}
      className="pill pill-dark"
    >
      <span aria-hidden>{copied ? "✓" : "↗"}</span>
      {copied ? "Link copied" : "Share profile"}
    </button>
  );
}
