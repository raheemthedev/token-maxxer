import { clsx } from "clsx";
import type { ReactNode } from "react";

const TONES = {
  neutral: "bg-surface-muted text-foreground-muted",
  accent: "bg-accent-soft text-accent",
  green: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
} as const;

export function Badge({
  tone = "neutral",
  children,
  title,
  className,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
