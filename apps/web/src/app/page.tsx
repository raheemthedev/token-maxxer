import Link from "next/link";
import { getLeaderboard } from "@/lib/leaderboard";
import type { LeaderboardPeriod } from "@/lib/period";
import { DatabaseUnavailableNotice } from "@/components/DatabaseUnavailableNotice";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { EvidenceBadge } from "@/components/EvidenceBadge";

const TABS: { key: LeaderboardPeriod; label: string }[] = [
  { key: "weekly", label: "This week" },
  { key: "daily", label: "Today" },
  { key: "all_time", label: "All time" },
];

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const RANK_STYLES = [
  "bg-accent text-accent-foreground",
  "bg-surface-muted text-foreground",
  "bg-surface-muted text-foreground",
];

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: rawPeriod } = await searchParams;
  const period: LeaderboardPeriod =
    rawPeriod === "daily" || rawPeriod === "all_time" ? rawPeriod : "weekly";

  let rows: Awaited<ReturnType<typeof getLeaderboard>> = [];
  let dbUnavailable = false;
  try {
    rows = await getLeaderboard(period);
  } catch {
    dbUnavailable = true;
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Token Maxxer</h1>
          <p className="mt-1 text-foreground-muted">Show your usage. Show what you shipped.</p>
        </div>
        <div className="flex gap-1 rounded-full border border-border-soft bg-surface p-1">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={`/?period=${tab.key}`}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                period === tab.key
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      <Card className="mb-6 flex flex-col gap-1 bg-surface-muted !shadow-none sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground-muted">
          <strong className="text-foreground">Headline counting rule:</strong> input + output +
          cache-read + cache-write tokens (plus reasoning, when reported separately). Different
          models use very different amounts of tokens for similar work — this ranks consumption,
          not productivity. Periods are UTC; the week starts Monday 00:00 UTC.
        </p>
        <Link href="/about" className="shrink-0 text-sm font-medium text-accent hover:underline">
          How counting works →
        </Link>
      </Card>

      {dbUnavailable ? (
        <DatabaseUnavailableNotice />
      ) : rows.length === 0 ? (
        <Card className="py-16 text-center text-foreground-muted">
          No one has published usage for this period yet.
        </Card>
      ) : (
        <Card className="divide-y divide-border-soft p-0">
          {rows.map((row) => (
            <div
              key={row.userId}
              className="relative flex items-center gap-4 px-5 py-4 transition-colors first:rounded-t-[1.25rem] last:rounded-b-[1.25rem] hover:bg-surface-muted"
            >
              <Link href={`/u/${row.handle}`} className="absolute inset-0" aria-label={row.name ?? row.handle} />

              <span
                className={`stat-number flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  RANK_STYLES[row.rank - 1] ?? "text-foreground-muted"
                }`}
              >
                {row.rank}
              </span>

              <Avatar src={row.image} alt={row.name ?? row.handle} size={36} />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{row.name ?? `@${row.handle}`}</span>
                  <span className="text-sm text-foreground-muted">@{row.handle}</span>
                  {row.handle.startsWith("demo-") && <Badge tone="purple">Demo data</Badge>}
                </div>
                <div className="mt-0.5 truncate text-sm text-foreground-muted">
                  {row.projects.length === 0 ? (
                    "No public projects"
                  ) : (
                    row.projects.map((p, i) => (
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
                    ))
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="stat-number text-xl font-semibold">
                  {formatTokens(row.totalTokens)}
                  {row.hasUnknownCategories && (
                    <span title="Some token categories weren't reported by this user's connector(s)." className="ml-0.5 text-accent">
                      *
                    </span>
                  )}
                </div>
                <div className="text-xs text-foreground-muted">tokens</div>
              </div>

              <div className="hidden shrink-0 sm:block">
                <EvidenceBadge level="locally_reported" />
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
