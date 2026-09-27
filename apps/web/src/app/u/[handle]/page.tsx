import { notFound } from "next/navigation";
import { getPublicProfile } from "@/lib/profile";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { DatabaseUnavailableNotice } from "@/components/DatabaseUnavailableNotice";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { StatTile } from "@/components/ui/StatTile";

function formatTokens(n: number): string {
  return n.toLocaleString();
}

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  let profile: Awaited<ReturnType<typeof getPublicProfile>>;
  try {
    profile = await getPublicProfile(handle);
  } catch {
    return <DatabaseUnavailableNotice />;
  }
  if (!profile) notFound();

  return (
    <div>
      {profile.handle.startsWith("demo-") && (
        <Card className="mb-6 border-purple-200 bg-purple-50 text-sm text-purple-800 dark:border-purple-900 dark:bg-purple-900/30 dark:text-purple-300">
          This is synthetic demo data used to preview the product. It is not real usage.
        </Card>
      )}
      <div className="mb-8 flex items-center gap-4">
        <Avatar src={profile.image} alt={profile.name ?? profile.handle} size={64} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{profile.name ?? `@${profile.handle}`}</h1>
          <p className="text-foreground-muted">@{profile.handle}</p>
          {profile.bio && <p className="mt-1 text-sm">{profile.bio}</p>}
        </div>
      </div>

      <Card className="mb-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-foreground-muted">Approved aggregate usage (all time)</h2>
          {profile.publishedAt && (
            <span className="text-xs text-foreground-muted">
              Published {profile.publishedAt.toISOString().slice(0, 10)}
            </span>
          )}
        </div>
        <p className="stat-number text-4xl font-semibold">
          {formatTokens(profile.totalTokens)}
          {profile.hasUnknownCategories && <span className="ml-1 text-accent">*</span>}
          <span className="ml-2 text-base font-normal text-foreground-muted">tokens (headline total)</span>
        </p>
        {profile.hasUnknownCategories && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            * Some token categories weren&apos;t reported by at least one connector — not counted
            as zero, just not shown separately.
          </p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border-soft pt-5 sm:grid-cols-5">
          <StatTile label="Input" value={profile.bucketTotals.input.toLocaleString()} />
          <StatTile label="Output" value={profile.bucketTotals.output.toLocaleString()} />
          <StatTile label="Cache read" value={profile.bucketTotals.cacheRead.toLocaleString()} />
          <StatTile label="Cache write" value={profile.bucketTotals.cacheWrite.toLocaleString()} />
          <StatTile label="Reasoning" value={profile.bucketTotals.reasoning.toLocaleString()} />
        </div>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-medium text-foreground-muted">By source</h2>
          <ul className="space-y-3 text-sm">
            {profile.bySource.map((s) => (
              <li key={s.source} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {s.source} <EvidenceBadge level={s.evidenceLevel} />
                </span>
                <span className="stat-number font-medium">{formatTokens(s.tokens)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-medium text-foreground-muted">By model</h2>
          <ul className="space-y-3 text-sm">
            {profile.byModel.map((m) => (
              <li key={m.model} className="flex items-center justify-between">
                <span>{m.model}</span>
                <span className="stat-number font-medium">{formatTokens(m.tokens)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-foreground-muted">Projects</h2>
        {profile.projects.length === 0 ? (
          <Card className="text-sm text-foreground-muted">No public projects yet.</Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {profile.projects.map((p) => (
              <Card key={p.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-medium">
                    {p.linkUrl ? (
                      <a
                        href={p.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="underline decoration-border-soft underline-offset-2 hover:decoration-accent"
                      >
                        {p.displayName} ↗
                      </a>
                    ) : (
                      p.displayName
                    )}
                  </h3>
                  <Badge tone={p.linkUrl ? "accent" : "neutral"} className="shrink-0">
                    {p.linkUrl ? "Project linked" : "Project detected"}
                  </Badge>
                </div>
                {p.description && <p className="mt-1 text-sm text-foreground-muted">{p.description}</p>}
                <p className="stat-number mt-3 text-sm font-medium">{formatTokens(p.tokens)} tokens</p>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
