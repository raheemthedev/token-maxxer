"use client";

import { useId, useState } from "react";

export interface ChartPoint {
  label: string;
  value: number;
}

function compact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

/** Smooth gradient area chart with a hover tooltip, dashed peak line and glowing end point. */
export function AreaChart({ points, height = 180 }: { points: ChartPoint[]; height?: number }) {
  const gid = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const pad = { t: 28, b: 6 };
  const max = Math.max(1, ...points.map((p) => p.value));
  const n = points.length;
  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => pad.t + (1 - v / max) * (height - pad.t - pad.b);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`;
  const active = hover ?? n - 1;
  const ap = points[active];
  const tipLeft = Math.min(88, Math.max(12, (x(active) / W) * 100));

  return (
    <div className="relative" style={{ height }}>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
        }}
        role="img"
        aria-label={`Daily tokens, peak ${compact(max)}`}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8622c" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#e8622c" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" x2={W} y1={y(max)} y2={y(max)} stroke="#c9c9c6" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
        {n > 0 && <path d={area} fill={`url(#${gid})`} />}
        <path d={line} fill="none" stroke="#e8622c" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {ap && <line x1={x(active)} x2={x(active)} y1={pad.t} y2={height} stroke="#b9b9b6" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />}
      </svg>
      {ap && (
        <>
          <span
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_0_5px_rgba(232,98,44,0.18)]"
            style={{ left: `${(x(active) / W) * 100}%`, top: y(ap.value) }}
          />
          <div
            className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-xl bg-surface px-3 py-1.5 text-xs shadow-[0_6px_20px_-6px_rgba(0,0,0,0.25)] ring-1 ring-border-soft"
            style={{ left: `${tipLeft}%`, top: 0 }}
          >
            <span className="text-foreground-muted">{ap.label}</span> <span className="stat-number font-semibold">{compact(ap.value)}</span>
          </div>
        </>
      )}
    </div>
  );
}
