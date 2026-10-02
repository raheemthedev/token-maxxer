"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardProject } from "@/lib/dashboard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatTokens } from "@/lib/formatTokens";

const LINK_LABELS = ["repository", "live", "demo", "release", "video"] as const;

export function ProjectCard({
  project,
  mergeTargets,
}: {
  project: DashboardProject;
  mergeTargets: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(project.displayName ?? project.detectedNameLocal);
  const [description, setDescription] = useState(project.description ?? "");
  const [linkUrl, setLinkUrl] = useState(project.linkUrl ?? "");
  const [linkLabel, setLinkLabel] = useState(project.linkLabel ?? "repository");
  const [mergeTarget, setMergeTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function request(url: string, method: string, body?: Record<string, unknown>) {
    setSaving(true); setError(null);
    try {
      const res = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error ?? "Update failed. Try again."); }
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Connection failed. Try again."); }
    finally { setSaving(false); }
  }
  const fields = () => ({ displayName: displayName.trim() || null, description: description.trim() || null, linkUrl: linkUrl.trim() || null, linkLabel });
  const dirty = displayName !== (project.displayName ?? project.detectedNameLocal) || description !== (project.description ?? "") || linkUrl !== (project.linkUrl ?? "") || linkLabel !== (project.linkLabel ?? "repository");
  async function patch(body: Record<string, unknown>) { await request(`/api/projects/${project.id}`, "PATCH", body); }
  async function handleDelete() {
    if (!confirm(`Permanently delete this project and its ${formatTokens(project.tokens)} tokens? This cannot be undone.`)) return;
    await request(`/api/projects/${project.id}`, "DELETE");
  }
  async function handleMerge() {
    if (mergeTarget) await request("/api/projects/merge", "POST", { sourceId: project.id, targetId: mergeTarget });
  }

  return (
    <Card className="min-w-0 break-words">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{project.displayName || project.detectedNameLocal}</h3>
          <p className="stat-number mt-1 text-lg font-semibold">{formatTokens(project.tokens)} <span className="text-sm font-normal text-foreground-muted">tokens</span></p>
        </div>
        <Badge tone={project.visibility === "public" ? "green" : "neutral"}>
          {project.hidden ? "Hidden" : project.visibility === "public" ? "Public" : "Private"}
        </Badge>
      </div>

      <details className="mt-4">
      <summary className="cursor-pointer text-sm font-medium text-accent">Edit details</summary>
      <div className="mt-4 border-t border-border-soft pt-4">
      <label className="mb-2 block text-sm">
        <span className="text-foreground-muted">Project name</span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Project name"
          className="mt-1 w-full rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
      </label>

      <label className="mb-3 block text-sm">
        <span className="text-foreground-muted">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
      </label>

      <div className="mb-4 flex gap-2">
        <select
          aria-label="Link type"
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
          aria-label="Project link"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="https://…"
          className="min-w-0 flex-1 rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {dirty && <button disabled={saving} onClick={() => patch(fields())} className="rounded-full bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-50">{saving ? "Saving…" : "Save changes"}</button>}
        <button
          disabled={saving}
          onClick={() => patch({ ...fields(), visibility: project.visibility === "public" ? "private" : "public" })}
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
        <button
          disabled={saving}
          onClick={handleDelete}
          className="rounded-full border border-red-200 px-3.5 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          Delete
        </button>

        {mergeTargets.length > 0 && (
          <div className="ml-auto flex max-w-full items-center gap-1">
            <select
              aria-label="Merge into project"
              value={mergeTarget}
              onChange={(e) => setMergeTarget(e.target.value)}
              className="min-w-0 rounded-lg border border-border-soft bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent"
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

      </div>
      </details>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </Card>
  );
}
