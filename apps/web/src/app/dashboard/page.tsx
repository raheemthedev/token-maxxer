import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getDashboardData } from "@/lib/dashboard";
import { PublishToggle } from "@/components/PublishToggle";
import { ProjectCard } from "@/components/ProjectCard";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { DatabaseUnavailableNotice } from "@/components/DatabaseUnavailableNotice";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatTile } from "@/components/ui/StatTile";

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
  const activeCollectors = data.collectors.filter((c) => c.status === "active").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-foreground-muted">Your usage, projects, and sharing settings.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <StatTile label="Total tokens" value={data.totalTokens.toLocaleString()} />
        </Card>
        <Card>
          <StatTile
            label="Unassigned"
            value={data.unassignedTokens.toLocaleString()}
            caption={data.unassignedTokens > 0 ? "not attributed to a project" : undefined}
          />
        </Card>
        <Card>
          <StatTile label="Active collectors" value={activeCollectors} />
        </Card>
      </div>

      <PublishToggle isPublic={data.isPublic} handle={session.user.handle} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Collectors</h2>
          <Link href="/dashboard/collector" className="text-sm font-medium text-accent hover:underline">
            Manage / pair new
          </Link>
        </div>
        {data.collectors.length === 0 ? (
          <Card className="text-sm text-foreground-muted">
            No collector paired yet.{" "}
            <Link href="/dashboard/collector" className="text-accent hover:underline">
              Set one up
            </Link>{" "}
            to start collecting usage.
          </Card>
        ) : (
          <Card className="divide-y divide-border-soft p-0">
            {data.collectors.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="font-medium">{c.name}</span>
                <span className="flex items-center gap-2 text-foreground-muted">
                  {c.lastSeenAt && <span>last seen {new Date(c.lastSeenAt).toLocaleString()}</span>}
                  <Badge tone={c.status === "active" ? "green" : "neutral"}>{c.status}</Badge>
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-medium">
          Projects{" "}
          <span className="text-sm font-normal text-foreground-muted">
            (rename, publish, hide, link, or merge duplicates)
          </span>
        </h2>
        {data.unassignedTokens > 0 && (
          <Card className="mb-4 bg-surface-muted text-sm text-foreground-muted !shadow-none">
            {data.unassignedTokens.toLocaleString()} tokens couldn&apos;t be attributed to a
            project automatically and are not shown below or on your public profile.
          </Card>
        )}
        {visibleProjects.length === 0 ? (
          <Card className="text-sm text-foreground-muted">
            No projects detected yet — pair a collector to get started.
          </Card>
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
            <summary className="cursor-pointer text-sm text-foreground-muted">
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

      <section className="border-t border-border-soft pt-6">
        <h2 className="mb-2 font-medium text-red-700 dark:text-red-400">Danger zone</h2>
        <DeleteAccountButton />
      </section>
    </div>
  );
}
