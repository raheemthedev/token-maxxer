export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-40 rounded-[1.75rem] bg-surface-muted" />
      <div className="h-10 w-72 rounded-full bg-surface-muted" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-surface-muted" />
        ))}
      </div>
    </div>
  );
}
