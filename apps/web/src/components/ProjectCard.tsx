"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardProject } from "@/lib/dashboard";

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
    <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-xs text-neutral-400">
            Detected as &ldquo;{project.detectedNameLocal}&rdquo; via {project.detectionMethod.replace("_", " ")}
          </p>
          <p className="font-mono text-sm">{project.tokens.toLocaleString()} tokens</p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            project.visibility === "public"
              ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
              : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
          }`}
        >
          {project.visibility === "public" ? "Public" : "Private"}
        </span>
      </div>

      <label className="mb-2 block text-sm">
        Display name (required to publish)
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onBlur={() => displayName !== (project.displayName ?? "") && patch({ displayName: displayName || null })}
          placeholder="Choose a public name"
          className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>

      <label className="mb-2 block text-sm">
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== (project.description ?? "") && patch({ description: description || null })}
          rows={2}
          className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>

      <div className="mb-3 flex gap-2">
        <select
          value={linkLabel}
          onChange={(e) => setLinkLabel(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
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
          className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          disabled={saving}
          onClick={() => patch({ visibility: project.visibility === "public" ? "private" : "public" })}
          className="rounded-md border border-neutral-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-neutral-700"
        >
          {project.visibility === "public" ? "Make private" : "Publish"}
        </button>
        <button
          disabled={saving}
          onClick={() => patch({ hidden: !project.hidden })}
          className="rounded-md border border-neutral-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-neutral-700"
        >
          {project.hidden ? "Unhide" : "Hide"}
        </button>

        {mergeTargets.length > 0 && (
          <div className="ml-auto flex items-center gap-1">
            <select
              value={mergeTarget}
              onChange={(e) => setMergeTarget(e.target.value)}
              className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
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
              className="rounded-md border border-neutral-300 px-2 py-1 text-xs disabled:opacity-50 dark:border-neutral-700"
            >
              Merge
            </button>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
