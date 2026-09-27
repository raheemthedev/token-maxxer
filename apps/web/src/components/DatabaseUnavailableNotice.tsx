export function DatabaseUnavailableNotice() {
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
      <p className="font-medium">Database not configured yet.</p>
      <p className="mt-1">
        This deployment doesn&apos;t have a working <code>DATABASE_URL</code> — SQLite (the local
        dev default) doesn&apos;t persist on serverless hosting. See{" "}
        <code>docs/SETUP.md</code> for connecting a real Postgres database.
      </p>
    </div>
  );
}
