import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getDashboardData } from "@/lib/dashboard";
import { PublishToggle } from "@/components/PublishToggle";
import { ProjectCard } from "@/components/ProjectCard";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { DatabaseUnavailableNotice } from "@/components/DatabaseUnavailableNotice";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatTile } from "@/components/ui/StatTile";
import { BUCKET_COLORS, ShareBar, StackedBar } from "@/components/ui/Bars";

const SOURCE_LABELS: Record<string, string> = { claude_code: "Claude Code", codex: "Codex CLI", opencode: "OpenCode", synthetic: "Demo" };
function compact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  let data: Awaited<ReturnType<typeof getDashboardData>>;
  try {
    data = await getDashboardData(session.user.id);
  } catch {
    return <DatabaseUnavailableNotice />;
  }
  const visibleProjects = data.projects.filter((p) => !p.hidden);
  const hiddenProjects = data.projects.filter((p) => p.hidden);
  const activeCollectors = data.collectors.filter((c) => c.status === "active").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-foreground-muted">Your usage, projects, and sharing settings.</p>
        </div>
        {session.user.handle && (
          <Link href={`/u/${session.user.handle}`} className="rounded-full border border-border-soft px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-muted">
            View public profile ↗
          </Link>
        )}
      </div>

      {(data.collectors.length === 0 || data.totalTokens === 0) && (
        <Card className="border-accent/30 bg-accent-soft/40">
          <h2 className="font-medium">Get your first tokens on the board</h2>
          <ol className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            {[
              ["Connect a tool", "Generate a setup snippet (Claude Code) or pair the CLI collector (Codex, OpenCode).", data.collectors.length > 0],
              ["See your usage", "Totals, tools and detected projects appear here after the first upload.", data.totalTokens > 0],
              ["Publish when ready", "Nothing is public until you switch it on below.", data.isPublic],
            ].map(([title, body, done], i) => (
              <li key={i as number} className="flex gap-3">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? "bg-accent text-accent-foreground" : "bg-surface text-foreground-muted"}`}>
                  {done ? "✓" : (i as number) + 1}
                </span>
                <span>
                  <span className="block font-medium">{title as string}</span>
                  <span className="text-foreground-muted">{body as string}</span>
                </span>
              </li>
            ))}
          </ol>
          <Link href="/dashboard/collector" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
            Set up tracking →
          </Link>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="sm:col-span-2">
          <StatTile label="Total tokens" value={data.totalTokens.toLocaleString()} caption={data.totalTokens > 0 ? `${compact(data.totalTokens)} processed across ${data.bySource.length} tool${data.bySource.length === 1 ? "" : "s"}` : undefined} />
          {data.totalTokens > 0 && (
            <div className="mt-5">
              <StackedBar
                segments={[
                  { label: "Fresh input", value: data.buckets.input, color: BUCKET_COLORS.input },
                  { label: "Output", value: data.buckets.output, color: BUCKET_COLORS.output },
                  { label: "Cache read", value: data.buckets.cacheRead, color: BUCKET_COLORS.cacheRead },
                  { label: "Cache write", value: data.buckets.cacheWrite, color: BUCKET_COLORS.cacheWrite },
                ]}
              />
            </div>
          )}
        </Card>
        <div className="grid gap-4">
          <Card>
            <StatTile label="Unassigned" value={data.unassignedTokens.toLocaleString()} caption={data.unassignedTokens > 0 ? "not attributed to a project" : "everything is attributed"} />
          </Card>
          <Card>
            <StatTile label="Active collectors" value={activeCollectors} />
          </Card>
        </div>
      </div>

      {data.bySource.length > 0 && (
        <Card>
          <h2 className="mb-4 text-sm font-medium text-foreground-muted">By tool</h2>
          <ul className="space-y-4">
            {data.bySource.map((src) => (
              <li key={src.source}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="font-medium">{SOURCE_LABELS[src.source] ?? src.source}</span>
                  <span className="stat-number font-semibold">{compact(src.tokens)}</span>
                </div>
                <ShareBar value={src.tokens} max={data.bySource[0].tokens} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <PublishToggle isPublic={data.isPublic} handle={session.user.handle} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Collectors</h2>
          <Link href="/dashboard/collector" className="text-sm font-medium text-accent hover:underline">
            Manage / pair new
          </Link>
        </div>
        {data.collectors.length === 0 ? (
          <Card className="text-sm text-foreground-muted">
            No collector paired yet.{" "}
            <Link href="/dashboard/collector" className="text-accent hover:underline">
              Set one up
            </Link>{" "}
            to start collecting usage.
          </Card>
        ) : (
          <Card className="divide-y divide-border-soft p-0">
            {data.collectors.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="font-medium">{c.name}</span>
                <span className="flex items-center gap-2 text-foreground-muted">
                  {c.lastSeenAt && <span>last seen {new Date(c.lastSeenAt).toLocaleString()}</span>}
                  <Badge tone={c.status === "active" ? "green" : "neutral"}>{c.status}</Badge>
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-medium">
          Projects{" "}
          <span className="text-sm font-normal text-foreground-muted">
            (rename, publish, hide, link, or merge duplicates)
          </span>
        </h2>
        {data.unassignedTokens > 0 && (
          <Card className="mb-4 bg-surface-muted text-sm text-foreground-muted !shadow-none">
            {data.unassignedTokens.toLocaleString()} tokens couldn&apos;t be attributed to a
            project automatically and are not shown below or on your public profile.
          </Card>
        )}
        {visibleProjects.length === 0 ? (
          <Card className="text-sm text-foreground-muted">
            No projects detected yet — pair a collector to get started.
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {visibleProjects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                mergeTargets={visibleProjects
                  .filter((other) => other.id !== p.id)
                  .map((other) => ({ id: other.id, label: other.displayName ?? other.detectedNameLocal }))}
              />
            ))}
          </div>
        )}

        {hiddenProjects.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-foreground-muted">
              {hiddenProjects.length} hidden project(s)
            </summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {hiddenProjects.map((p) => (
                <ProjectCard key={p.id} project={p} mergeTargets={[]} />
              ))}
            </div>
          </details>
        )}
      </section>

      <section className="border-t border-border-soft pt-6">
        <h2 className="mb-2 font-medium text-red-700 dark:text-red-400">Danger zone</h2>
        <DeleteAccountButton />
      </section>
    </div>
  );
}
