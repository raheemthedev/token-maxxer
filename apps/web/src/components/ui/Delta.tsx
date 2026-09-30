/** Green/red change chip, like the reference dashboards. `pct` null → renders nothing (no fake deltas). */
export function Delta({ pct, label }: { pct: number | null; label?: string }) {
  if (pct === null || !Number.isFinite(pct)) return null;
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
        up ? "bg-positive-soft text-positive" : "bg-red-100 text-red-700"
      }`}
    >
      <span aria-hidden>{up ? "↑" : "↓"}</span>
      {Math.abs(pct).toFixed(Math.abs(pct) >= 100 ? 0 : 1)}%{label && <span className="font-normal opacity-70"> {label}</span>}
    </span>
  );
}
