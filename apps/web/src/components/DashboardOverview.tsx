import { formatTokens as compact } from "@/lib/formatTokens";
import Link from "next/link";
import type { DashboardData } from "@/lib/dashboard";
import { getDailySeries } from "@/lib/series";
import { ActivityCard, type Range } from "@/components/ActivityCard";
import { BUCKET_COLORS, StackedBar } from "@/components/ui/Bars";


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
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1fr]">
      <div className="card relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent-soft blur-3xl" />
        <div className="relative">
          <div className="eyebrow">All-time usage</div>
          <div className="stat-number mt-3 text-5xl font-semibold leading-none sm:text-7xl">{compact(data.totalTokens)}</div>
          <p className="stat-number mt-2 text-sm text-foreground-muted">
            Tokens across your recorded history
            {data.bySource.length > 0 && ` · ${data.bySource.length} tool${data.bySource.length === 1 ? "" : "s"}`}
          </p>

          {data.hasUnknownCategories && <p className="mt-2 text-xs text-foreground-muted">Some token categories aren’t reported. Totals include available counts.</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            {handle && (
              <Link href={data.isPublic ? `/u/${handle}` : "/dashboard/preview"} className="pill pill-dark">
                <span aria-hidden>↗</span> {data.isPublic ? "View public profile" : "Preview profile"}
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
