"use client";

import { useState } from "react";
import type { DashboardProject } from "@/lib/dashboard";
import { ProjectCard } from "./ProjectCard";
import { Card } from "./ui/Card";

const name = (p: DashboardProject) => p.displayName || p.detectedNameLocal;

export function ProjectList({ projects }: { projects: DashboardProject[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("tokens");
  const matching = projects.filter(p => name(p).toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => {
    if (sort === "name") return name(a).localeCompare(name(b));
    if (sort === "name-desc") return name(b).localeCompare(name(a));
    if (sort === "tokens-asc") return a.tokens - b.tokens || name(a).localeCompare(name(b));
    if (sort === "tokens") return b.tokens - a.tokens || name(a).localeCompare(name(b));
    return b.tokens - a.tokens || name(a).localeCompare(name(b));
  });
  const visible = matching.filter(p => !p.hidden);
  const hidden = matching.filter(p => p.hidden);
  const targets = projects.filter(p => !p.hidden).map(p => ({ id: p.id, label: name(p) }));
  const cards = (list: DashboardProject[]) => <div className="space-y-2">{list.map(p => <ProjectCard key={p.id} project={p} mergeTargets={targets.filter(t => t.id !== p.id)} />)}</div>;

  return <div className="space-y-4">
    <p className="text-sm text-foreground-muted">{projects.filter(p => !p.hidden).length} folder projects</p>
    {projects.length > 0 && <div className="flex flex-col gap-3 sm:flex-row">
      <input type="search" aria-label="Search projects" placeholder="Search projects" value={query} onChange={e => setQuery(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-border-soft bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent" />
      <select aria-label="Sort projects" value={sort} onChange={e => setSort(e.target.value)} className="rounded-xl border border-border-soft bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent">
        <option value="tokens">Most tokens</option><option value="tokens-asc">Fewest tokens</option><option value="name">Name: A–Z</option><option value="name-desc">Name: Z–A</option>
      </select>
    </div>}
    {visible.length ? cards(visible) : <Card className="text-sm text-foreground-muted">{query ? "No projects match your search." : projects.length ? "Your projects are hidden. Expand hidden projects below to restore them." : "Projects appear here when your tools report a working folder."}</Card>}
    {hidden.length > 0 && <details><summary className="cursor-pointer text-sm text-foreground-muted">Hidden projects ({hidden.length})</summary><div className="mt-3">{cards(hidden)}</div></details>}
  </div>;
}
