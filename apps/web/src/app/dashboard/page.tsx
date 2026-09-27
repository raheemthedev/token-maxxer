import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getDashboardData } from "@/lib/dashboard";
import { PublishToggle } from "@/components/PublishToggle";
import { ProjectCard } from "@/components/ProjectCard";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { DatabaseUnavailableNotice } from "@/components/DatabaseUnavailableNotice";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  let data: Awaited<ReturnType<typeof getDashboardData>>;
  try {
    data = await getDashboardData(session.user.id);
  } catch {
    return <DatabaseUnavailableNotice />;
  }
  const visibleProjects = data.projects.filter((p) => !p.hidden);
  const hiddenProjects = data.projects.filter((p) => p.hidden);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-neutral-500">
          {data.totalTokens.toLocaleString()} tokens collected total ·{" "}
          {data.unassignedTokens.toLocaleString()} unassigned
        </p>
      </div>

      <PublishToggle isPublic={data.isPublic} handle={session.user.handle} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Collectors</h2>
          <Link href="/dashboard/collector" className="text-sm underline">
            Manage / pair new
          </Link>
        </div>
        {data.collectors.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No collector paired yet. <Link href="/dashboard/collector" className="underline">Set one up</Link> to
            start collecting usage.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.collectors.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800">
                <span>
                  {c.name} — {c.status}
                  {c.lastSeenAt && (
                    <span className="ml-2 text-neutral-400">last seen {new Date(c.lastSeenAt).toLocaleString()}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-medium">
          Projects{" "}
          <span className="text-sm font-normal text-neutral-500">
            (rename, publish, hide, link, or merge duplicates)
          </span>
        </h2>
        {data.unassignedTokens > 0 && (
          <p className="mb-3 rounded-md bg-neutral-100 p-2 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            {data.unassignedTokens.toLocaleString()} tokens couldn&apos;t be attributed to a
            project automatically and are not shown below or on your public profile.
          </p>
        )}
        {visibleProjects.length === 0 ? (
          <p className="text-sm text-neutral-500">No projects detected yet — pair a collector to get started.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {visibleProjects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                mergeTargets={visibleProjects
                  .filter((other) => other.id !== p.id)
                  .map((other) => ({ id: other.id, label: other.displayName ?? other.detectedNameLocal }))}
              />
            ))}
          </div>
        )}

        {hiddenProjects.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-neutral-500">
              {hiddenProjects.length} hidden project(s)
            </summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {hiddenProjects.map((p) => (
                <ProjectCard key={p.id} project={p} mergeTargets={[]} />
              ))}
            </div>
          </details>
        )}
      </section>

      <section className="border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <h2 className="mb-2 font-medium text-red-700 dark:text-red-400">Danger zone</h2>
        <DeleteAccountButton />
      </section>
    </div>
  );
}
