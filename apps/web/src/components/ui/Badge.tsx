import { clsx } from "clsx";
import type { ReactNode } from "react";

const TONES = {
  neutral: { chip: "bg-surface-muted text-foreground-muted", dot: "bg-foreground-muted/50" },
  accent: { chip: "bg-accent-soft text-accent", dot: "bg-accent" },
  green: { chip: "bg-positive-soft text-positive", dot: "bg-positive" },
  amber: { chip: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  purple: { chip: "bg-purple-100 text-purple-700", dot: "bg-purple-500" },
  red: { chip: "bg-red-100 text-red-700", dot: "bg-red-500" },
} as const;

/** Status pill. `dot` adds a leading status dot (pulsing for `live`, e.g. "Receiving uploads"). */
export function Badge({
  tone = "neutral",
  children,
  title,
  className,
  dot,
  live,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
  title?: string;
  className?: string;
  dot?: boolean;
  live?: boolean;
}) {
  const t = TONES[tone];
  return (
    <span title={title} className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", t.chip, className)}>
      {(dot || live) && (
        <span className="relative flex h-1.5 w-1.5">
          {live && <span className={clsx("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", t.dot)} />}
          <span className={clsx("relative inline-flex h-1.5 w-1.5 rounded-full", t.dot)} />
        </span>
      )}
      {children}
    </span>
  );
}
