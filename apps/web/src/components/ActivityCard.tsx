import type { ReactNode } from "react";
import type { Series } from "@/lib/series";
import { AreaChart } from "@/components/ui/AreaChart";
import { Delta } from "@/components/ui/Delta";
import { Segmented } from "@/components/ui/Segmented";

export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];

export function parseRange(raw: string | undefined): Range {
  const n = Number(raw);
  return (RANGES as readonly number[]).includes(n) ? (n as Range) : 30;
}

function compact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const SOURCE_LABELS: Record<string, string> = { claude_code: "Claude Code", codex: "Codex CLI", opencode: "OpenCode" };

function fmtDay(d: string) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).toUpperCase();
}

export function ActivityCard({
  series,
  range,
  basePath,
  rows,
  action,
}: {
  series: Series;
  range: Range;
  basePath: string;
  rows?: { icon: ReactNode; label: string; value: string }[];
  action?: ReactNode;
}) {
  const pts = series.points;
  const hasData = series.total > 0;
  return (
    <div className="card p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="eyebrow">Daily activity · UTC</span>
        <Segmented
          active={String(range)}
          options={RANGES.map((r) => ({ key: String(r), label: `${r}d`, href: `${basePath}?range=${r}` }))}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-x-4 gap-y-2">
        <span className="stat-number text-5xl font-semibold leading-none sm:text-6xl">{compact(series.total)}</span>
        <Delta pct={series.deltaPct} label={`vs earlier ${Math.floor(range / 2)}d`} />
      </div>
      <p className="mt-1 text-sm text-foreground-muted">tokens in the last {range} days</p>

      <div className="mt-6">
        {hasData ? (
          <>
            <AreaChart points={pts.map((p) => ({ label: fmtDay(p.date), value: p.tokens }))} height={190} />
            <div className="eyebrow mt-2 flex justify-between">
              <span>{fmtDay(pts[0].date)}</span>
              <span>{fmtDay(pts[Math.floor(pts.length / 2)].date)}</span>
              <span>{fmtDay(pts[pts.length - 1].date)}</span>
            </div>
          </>
        ) : (
          <div className="flex h-[190px] items-center justify-center rounded-2xl bg-surface-muted/50 text-sm text-foreground-muted">
            No per-day activity in this range yet
          </div>
        )}
      </div>

      {series.excludedSources.length > 0 && (
        <p className="mt-3 rounded-xl bg-surface-muted/60 px-3 py-2 text-xs text-foreground-muted">
          Not shown here: {series.excludedSources.map((s) => SOURCE_LABELS[s] ?? s).join(", ")} — that tool reports a running total per session, which can&apos;t be placed on a specific day yet. It still counts in your all-time total.
        </p>
      )}

      {rows && rows.length > 0 && (
        <ul className="mt-6 space-y-3 border-t border-border-soft pt-5">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-3 text-[15px]">
              <span className="text-foreground-muted">{r.icon}</span>
              <span className="text-foreground-muted">{r.label}</span>
              <span className="stat-number ml-auto font-semibold">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
