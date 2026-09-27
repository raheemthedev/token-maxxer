import type { ReactNode } from "react";

export function StatTile({
  label,
  value,
  suffix,
  caption,
}: {
  label: string;
  value: ReactNode;
  suffix?: string;
  caption?: string;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-foreground-muted">{label}</div>
      <div className="stat-number mt-1 flex items-baseline gap-1 text-2xl font-semibold">
        {value}
        {suffix && <span className="text-xs font-normal text-foreground-muted">{suffix}</span>}
      </div>
      {caption && <div className="mt-0.5 text-xs text-foreground-muted">{caption}</div>}
    </div>
  );
}
