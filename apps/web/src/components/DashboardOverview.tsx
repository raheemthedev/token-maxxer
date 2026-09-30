import Link from "next/link";
import type { DashboardData } from "@/lib/dashboard";
import { getDailySeries } from "@/lib/series";
import { ActivityCard, type Range } from "@/components/ActivityCard";
import { BUCKET_COLORS, StackedBar } from "@/components/ui/Bars";

function compact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export async function DashboardOverview({
  data,
  userId,
  handle,
  range,
}: {
  data: DashboardData;
  userId: string;
  handle: string | null;
  range: Range;
}) {
  const series = await getDailySeries(userId, range).catch(() => null);
  const activeCollectors = data.collectors.filter((c) => c.status === "active").length;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
      <div className="card relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent-soft blur-3xl" />
        <div className="relative">
          <div className="eyebrow">Tokens processed · all time</div>
          <div className="stat-number mt-3 text-5xl font-semibold leading-none sm:text-7xl">{compact(data.totalTokens)}</div>
          <p className="stat-number mt-2 text-sm text-foreground-muted">
            {data.totalTokens.toLocaleString()} headline total
            {data.bySource.length > 0 && ` · ${data.bySource.length} tool${data.bySource.length === 1 ? "" : "s"}`}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {handle && (
              <Link href={`/u/${handle}`} className="pill pill-dark">
                <span aria-hidden>↗</span> View public profile
              </Link>
            )}
            <Link href="/dashboard/collector" className="pill pill-light">
              Connect tools
            </Link>
          </div>

          {data.totalTokens > 0 && (
            <div className="mt-8 border-t border-border-soft pt-6">
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
        </div>
      </div>

      {series && (
        <ActivityCard
          series={series}
          range={range}
          basePath="/dashboard"
          rows={[
            { icon: "◐", label: "Unassigned usage", value: compact(data.unassignedTokens) },
            { icon: "▦", label: "Paired collectors", value: String(activeCollectors) },
            { icon: "◍", label: "Projects detected", value: String(data.projects.length) },
          ]}
        />
      )}
    </div>
  );
}
