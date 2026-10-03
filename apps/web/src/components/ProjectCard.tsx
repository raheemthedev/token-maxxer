"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardProject } from "@/lib/dashboard";
import { Card } from "@/components/ui/Card";
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
    <Card className="min-w-0 break-words !rounded-2xl !p-4 !shadow-none">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-foreground-muted"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M3 10h18"/></svg>
          <h3 className="truncate font-medium">{project.displayName || project.detectedNameLocal}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="stat-number text-sm font-semibold" title={`${project.tokens.toLocaleString()} tokens`}>{formatTokens(project.tokens)}<span className="sr-only"> tokens</span></span>
          <button disabled={saving || project.hidden} onClick={() => patch({ visibility: project.visibility === "public" ? "private" : "public" })}
            aria-label={`Make ${project.displayName || project.detectedNameLocal} ${project.visibility === "public" ? "private" : "public"}`}
            title="Private: name only. Public: links enabled."
            className={`rounded-full px-2.5 py-1 text-xs disabled:opacity-50 ${project.visibility === "public" ? "bg-green-100 text-green-700" : "bg-surface-muted text-foreground-muted"}`}>
            {saving ? "Saving…" : project.hidden ? "Hidden" : project.visibility === "public" ? "Public" : "Private"}
          </button>
        </div>
      </div>

      <details className="mt-2">
      <summary className="cursor-pointer text-xs font-medium text-accent">Edit details</summary>
      <div className="mt-4 border-t border-border-soft pt-4">
      <p className="mb-3 text-xs text-foreground-muted">On published profiles, private projects show their name without a link. Public projects can link out. Hide removes the project entirely.</p>
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
