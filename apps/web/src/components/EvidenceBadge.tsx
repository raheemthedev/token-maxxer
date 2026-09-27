const LABELS: Record<string, { text: string; title: string }> = {
  locally_reported: {
    text: "Locally reported",
    title:
      "Received from the builder's own paired collector. A paired collector authenticates who sent it, not that the local records are untampered.",
  },
  provider_verified: {
    text: "Provider verified",
    title: "Confirmed through a provider-backed verification mechanism.",
  },
};

export function EvidenceBadge({ level }: { level: string }) {
  const info = LABELS[level] ?? { text: level, title: level };
  return (
    <span
      title={info.title}
      className="inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
    >
      {info.text}
    </span>
  );
}
