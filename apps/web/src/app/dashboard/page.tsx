import type { Metadata } from "next";
import { formatTokens as compact } from "@/lib/formatTokens";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getDashboardData } from "@/lib/dashboard";
import { PublishToggle } from "@/components/PublishToggle";
import { ProjectList } from "@/components/ProjectList";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { DatabaseUnavailableNotice } from "@/components/DatabaseUnavailableNotice";
import { collectorStatus } from "@/lib/collectorStatus";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DashboardOverview } from "@/components/DashboardOverview";
import { parseRange } from "@/components/ActivityCard";
import { ShareBar } from "@/components/ui/Bars";

const SOURCE_LABELS: Record<string, string> = { claude_code: "Claude Code", codex: "Codex", opencode: "OpenCode", synthetic: "Demo" };


export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const range = parseRange((await searchParams).range);
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  let data: Awaited<ReturnType<typeof getDashboardData>>;
  try {
    data = await getDashboardData(session.user.id);
  } catch {
    return <DatabaseUnavailableNotice />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-foreground-muted">Your usage, projects, and sharing settings.</p>
        </div>
        {session.user.handle && (
          <Link href={data.isPublic ? `/u/${session.user.handle}` : "/dashboard/preview"} className="rounded-full border border-border-soft px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-muted">
            {data.isPublic ? "View public profile ↗" : "Preview your profile"}
          </Link>
        )}
      </div>

      {(data.collectors.length === 0 || data.totalTokens === 0 || !data.isPublic) && (
        <Card className="border-accent/30 bg-accent-soft/40">
          <h2 className="font-medium">Get your first tokens on the board</h2>
          <ol className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            {[
              ["Connect a tool", "Install one collector for Claude Code, Codex and OpenCode. It runs in the background.", data.collectors.length > 0],
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

      <DashboardOverview data={data} userId={session.user.id} handle={session.user.handle ?? null} range={range} />

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
            No collector connected yet.{" "}
            <Link href="/dashboard/collector" className="text-accent hover:underline">
              Set one up
            </Link>{" "}
            to start collecting usage.
          </Card>
        ) : (
          <Card className="divide-y divide-border-soft p-0">
            {data.collectors.map((c) => (
              <div key={c.id} className="flex flex-col items-start justify-between gap-2 px-5 py-3 text-sm sm:flex-row sm:items-center">
                <span className="font-medium">{c.name}</span>
                <span className="flex flex-wrap items-center gap-2 text-foreground-muted">
                  {c.lastSeenAt && <span>last seen {new Date(c.lastSeenAt).toLocaleString()}</span>}
                  <Badge tone={collectorStatus(c).tone} dot live={collectorStatus(c).tone === "green"}>{collectorStatus(c).label}</Badge>
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-medium">Projects</h2>
        {data.unassignedTokens > 0 && (
          <p className="mb-4 text-sm text-foreground-muted">
            {compact(data.unassignedTokens)} tokens from chats and other activity are included in your total.
          </p>
        )}
        <ProjectList projects={data.projects} />
      </section>

      <section className="border-t border-border-soft pt-6">
        <details><summary className="cursor-pointer text-sm text-foreground-muted">Account settings</summary><div className="mt-4"><DeleteAccountButton /></div></details>
      </section>
    </div>
  );
}
