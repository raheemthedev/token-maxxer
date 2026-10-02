import { formatTokens as compact } from "@/lib/formatTokens";
import Link from "next/link";
import { getLeaderboard } from "@/lib/leaderboard";
import type { LeaderboardPeriod } from "@/lib/period";
import { auth } from "@/auth";
import { DatabaseUnavailableNotice } from "@/components/DatabaseUnavailableNotice";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { ShareBar } from "@/components/ui/Bars";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { Segmented } from "@/components/ui/Segmented";

const TABS: { key: LeaderboardPeriod; label: string; blurb: string }[] = [
  { key: "weekly", label: "This week", blurb: "since Monday 00:00 UTC" },
  { key: "daily", label: "Today", blurb: "since 00:00 UTC" },
  { key: "all_time", label: "All time", blurb: "everything published" },
];


const MEDALS = ["bg-accent text-accent-foreground", "bg-[#d9d4cc] text-foreground", "bg-[#ecc9b3] text-foreground"];

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period: rawPeriod } = await searchParams;
  const period: LeaderboardPeriod = rawPeriod === "daily" || rawPeriod === "all_time" ? rawPeriod : "weekly";
  const tab = TABS.find((t) => t.key === period)!;
  const session = await auth().catch(() => null);

  let rows: Awaited<ReturnType<typeof getLeaderboard>> = [];
  let dbUnavailable = false;
  try {
    rows = await getLeaderboard(period);
  } catch {
    dbUnavailable = true;
  }

  const total = rows.reduce((a, r) => a + r.totalTokens, 0);
  const max = rows[0]?.totalTokens ?? 0;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-white/80 bg-gradient-to-b from-white to-surface p-7 shadow-[var(--shadow-card)] sm:p-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-soft blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <Badge tone="accent">Community leaderboard</Badge>
            <h1 className="mt-4 text-5xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-6xl">
              Show your usage.
              <br />
              <span className="text-accent">Show what you shipped.</span>
            </h1>
            <p className="mt-4 max-w-xl text-foreground-muted">
              Who&apos;s burning the most AI tokens while building — Claude Code, Codex and more — alongside the
              projects they chose to show. Nothing is public until its owner says so.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={session?.user ? "/dashboard" : "/sign-in"}
                className="pill pill-dark"
              >
                {session?.user ? "Open your dashboard" : "Get on the board"}
              </Link>
              <Link href="/about" className="pill pill-light">
                How counting works
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-3xl bg-surface-muted/70 p-5">
              <div className="stat-number text-4xl font-semibold">{rows.length}</div>
              <div className="eyebrow mt-1">Builders</div>
            </div>
            <div className="rounded-3xl bg-surface-muted/70 p-5">
              <div className="stat-number text-4xl font-semibold">{compact(total)}</div>
              <div className="eyebrow mt-1">Tokens · {tab.label.toLowerCase()}</div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented active={period} options={TABS.map((t) => ({ key: t.key, label: t.label, href: `/?period=${t.key}` }))} />
        <p className="text-xs text-foreground-muted">
          Counting {tab.blurb} · input + output + cache tokens · ranks consumption, not productivity
        </p>
      </div>

      {dbUnavailable ? (
        <DatabaseUnavailableNotice />
      ) : rows.length === 0 ? (
        <Card className="py-16 text-center">
          <p className="text-lg font-medium">Nobody on the board for this period yet</p>
          <p className="mt-1 text-sm text-foreground-muted">Be the first — sign in, connect your tools, and publish.</p>
        </Card>
      ) : (
        <Card className="divide-y divide-border-soft p-0">
          {rows.map((row) => (
            <div
              key={row.userId}
              className="relative flex items-center gap-4 px-5 py-5 transition-colors first:rounded-t-[1.75rem] last:rounded-b-[1.75rem] hover:bg-surface-muted/60"
            >
              <Link href={`/u/${row.handle}`} className="absolute inset-0" aria-label={row.name ?? row.handle} />

              <span
                className={`stat-number flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  MEDALS[row.rank - 1] ?? "bg-surface-muted text-foreground-muted"
                }`}
              >
                {row.rank}
              </span>
              <Avatar src={row.image} alt={row.name ?? row.handle} size={44} />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium">{row.name ?? `@${row.handle}`}</span>
                  <span className="text-sm text-foreground-muted">@{row.handle}</span>
                  {row.handle.startsWith("demo-") && <Badge tone="purple">Demo data</Badge>}
                  <span className="hidden sm:inline">
                    <EvidenceBadge level="locally_reported" />
                  </span>
                </div>
                <div className="mt-1 truncate text-sm text-foreground-muted">
                  {row.projects.length === 0
                    ? "No public projects"
                    : row.projects.map((p, i) => (
                        <span key={p.displayName}>
                          {i > 0 && " · "}
                          {p.linkUrl ? (
                            <a
                              href={p.linkUrl}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                              className="relative z-10 underline decoration-border-soft underline-offset-2 hover:decoration-accent"
                            >
                              {p.displayName} ↗
                            </a>
                          ) : (
                            p.displayName
                          )}
                        </span>
                      ))}
                </div>
                <ShareBar value={row.totalTokens} max={max} className="mt-3" />
              </div>

              <div className="shrink-0 text-right">
                <div className="stat-number text-2xl font-semibold">
                  {compact(row.totalTokens)}
                  {row.hasUnknownCategories && (
                    <span title="Some token categories weren't reported by this user's connector(s)." className="ml-0.5 text-accent">
                      *
                    </span>
                  )}
                </div>
                <div className="text-xs text-foreground-muted">tokens</div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
