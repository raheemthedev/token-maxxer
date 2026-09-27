export function DatabaseUnavailableNotice() {
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
      <p className="font-medium">Database not configured yet.</p>
      <p className="mt-1">
        This deployment doesn&apos;t have a working <code>DATABASE_URL</code> pointing at a real
        Postgres instance. See <code>docs/SETUP.md</code> for connecting one.
      </p>
    </div>
  );
}
