import Link from "next/link";
import { getLeaderboard } from "@/lib/leaderboard";
import type { LeaderboardPeriod } from "@/lib/period";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { DatabaseUnavailableNotice } from "@/components/DatabaseUnavailableNotice";

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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Token Maxxer</h1>
        <p className="text-neutral-500">Show your usage. Show what you shipped.</p>
      </div>

      <div className="mb-4 flex gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/?period=${tab.key}`}
            className={`rounded-full px-3 py-1 text-sm ${
              period === tab.key
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "border border-neutral-300 dark:border-neutral-700"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mb-6 rounded-md border border-neutral-200 bg-neutral-100 p-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        <strong>Headline counting rule:</strong> input + output + cache-read + cache-write tokens
        (plus reasoning tokens when a source reports them separately). We do not normalize across
        models — different models can use very different amounts of tokens for similar work, and
        this is a consumption leaderboard, not a productivity ranking. Periods are UTC; the week
        starts Monday 00:00 UTC. See <Link href="/about" className="underline">how counting works</Link>.
      </div>

      {dbUnavailable ? (
        <DatabaseUnavailableNotice />
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-300 p-8 text-center text-neutral-500 dark:border-neutral-700">
          No one has published usage for this period yet.
        </div>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800">
              <th className="py-2 pr-2 font-medium">Rank</th>
              <th className="py-2 pr-2 font-medium">Builder</th>
              <th className="py-2 pr-2 font-medium">Reported tokens</th>
              <th className="py-2 pr-2 font-medium">Projects</th>
              <th className="py-2 pr-2 font-medium">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.userId} className="border-b border-neutral-100 dark:border-neutral-900">
                <td className="py-3 pr-2 font-mono">{row.rank}</td>
                <td className="py-3 pr-2">
                  <Link href={`/u/${row.handle}`} className="flex items-center gap-2 hover:underline">
                    {row.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.image} alt="" className="h-6 w-6 rounded-full" />
                    ) : (
                      <span className="h-6 w-6 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                    )}
                    <span>{row.name ?? `@${row.handle}`}</span>
                    <span className="text-neutral-400">@{row.handle}</span>
                    {row.handle.startsWith("demo-") && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                        Demo data
                      </span>
                    )}
                  </Link>
                </td>
                <td className="py-3 pr-2 font-mono">
                  {formatTokens(row.totalTokens)}
                  {row.hasUnknownCategories && (
                    <span title="Some token categories weren't reported by this user's connector(s)." className="ml-1 text-amber-500">
                      *
                    </span>
                  )}
                </td>
                <td className="py-3 pr-2">
                  {row.projects.length === 0 ? (
                    <span className="text-neutral-400">—</span>
                  ) : (
                    row.projects.map((p, i) => (
                      <span key={p.displayName}>
                        {i > 0 && " · "}
                        {p.linkUrl ? (
                          <a href={p.linkUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline">
                            {p.displayName} ↗
                          </a>
                        ) : (
                          p.displayName
                        )}
                      </span>
                    ))
                  )}
                </td>
                <td className="py-3 pr-2">
                  <EvidenceBadge level="locally_reported" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
