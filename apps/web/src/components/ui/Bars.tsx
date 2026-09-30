import type { ReactNode } from "react";

/** Horizontal share bar: `value` relative to `max` (e.g. a row's tokens vs the leader's). */
export function ShareBar({ value, max, className = "" }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.max(2, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-surface-muted ${className}`}>
      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </div>
  );
}

export interface Segment {
  label: string;
  value: number;
  color: string;
}

/** Segmented composition bar with a legend showing each share. Unknown/zero segments are omitted. */
export function StackedBar({ segments, footer }: { segments: Segment[]; footer?: ReactNode }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {visible.map((s) => (
          <div key={s.label} title={`${s.label}: ${s.value.toLocaleString()}`} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} className="h-full first:rounded-l-full last:rounded-r-full" />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-4">
        {visible.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="text-foreground-muted">{s.label}</span>
            <span className="stat-number ml-auto font-medium">{((s.value / total) * 100).toFixed(total > 0 && s.value / total < 0.01 ? 1 : 0)}%</span>
          </li>
        ))}
      </ul>
      {footer}
    </div>
  );
}

export const BUCKET_COLORS = {
  input: "#e8622c",
  output: "#17150f",
  cacheRead: "#f3b48f",
  cacheWrite: "#9a8f83",
};
