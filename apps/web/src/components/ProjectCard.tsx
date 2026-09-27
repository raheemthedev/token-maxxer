"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardProject } from "@/lib/dashboard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const LINK_LABELS = ["repository", "live", "demo", "release", "video"] as const;

export function ProjectCard({
  project,
  mergeTargets,
}: {
  project: DashboardProject;
  mergeTargets: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(project.displayName ?? "");
  const [description, setDescription] = useState(project.description ?? "");
  const [linkUrl, setLinkUrl] = useState(project.linkUrl ?? "");
  const [linkLabel, setLinkLabel] = useState(project.linkLabel ?? "repository");
  const [mergeTarget, setMergeTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Update failed.");
      return;
    }
    router.refresh();
  }

  async function handleMerge() {
    if (!mergeTarget) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/projects/merge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceId: project.id, targetId: mergeTarget }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Merge failed.");
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-foreground-muted">
            Detected as &ldquo;{project.detectedNameLocal}&rdquo; via {project.detectionMethod.replace("_", " ")}
          </p>
          <p className="stat-number mt-0.5 text-lg font-semibold">{project.tokens.toLocaleString()} <span className="text-sm font-normal text-foreground-muted">tokens</span></p>
        </div>
        <Badge tone={project.visibility === "public" ? "green" : "neutral"}>
          {project.visibility === "public" ? "Public" : "Private"}
        </Badge>
      </div>

      <label className="mb-2 block text-sm">
        <span className="text-foreground-muted">Display name (required to publish)</span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onBlur={() => displayName !== (project.displayName ?? "") && patch({ displayName: displayName || null })}
          placeholder="Choose a public name"
          className="mt-1 w-full rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
      </label>

      <label className="mb-3 block text-sm">
        <span className="text-foreground-muted">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== (project.description ?? "") && patch({ description: description || null })}
          rows={2}
          className="mt-1 w-full rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
      </label>

      <div className="mb-4 flex gap-2">
        <select
          value={linkLabel}
          onChange={(e) => setLinkLabel(e.target.value)}
          className="rounded-lg border border-border-soft bg-surface px-2 py-1.5 text-sm outline-none focus:border-accent"
        >
          {LINK_LABELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <input
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          onBlur={() =>
            linkUrl !== (project.linkUrl ?? "") && patch({ linkUrl: linkUrl || null, linkLabel })
          }
          placeholder="https://…"
          className="flex-1 rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          disabled={saving}
          onClick={() => patch({ visibility: project.visibility === "public" ? "private" : "public" })}
          className="rounded-full border border-border-soft px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-surface-muted disabled:opacity-50"
        >
          {project.visibility === "public" ? "Make private" : "Publish"}
        </button>
        <button
          disabled={saving}
          onClick={() => patch({ hidden: !project.hidden })}
          className="rounded-full border border-border-soft px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-surface-muted disabled:opacity-50"
        >
          {project.hidden ? "Unhide" : "Hide"}
        </button>

        {mergeTargets.length > 0 && (
          <div className="ml-auto flex items-center gap-1">
            <select
              value={mergeTarget}
              onChange={(e) => setMergeTarget(e.target.value)}
              className="rounded-lg border border-border-soft bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent"
            >
              <option value="">Merge into…</option>
              {mergeTargets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              disabled={!mergeTarget || saving}
              onClick={handleMerge}
              className="rounded-lg border border-border-soft px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-surface-muted disabled:opacity-50"
            >
              Merge
            </button>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Card>
  );
}
