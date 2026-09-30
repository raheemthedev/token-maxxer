import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { getPublicProfile } from "@/lib/profile";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { DatabaseUnavailableNotice } from "@/components/DatabaseUnavailableNotice";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { BUCKET_COLORS, ShareBar, StackedBar } from "@/components/ui/Bars";

const SOURCE_LABELS: Record<string, string> = {
  claude_code: "Claude Code",
  codex: "Codex CLI",
  opencode: "OpenCode",
  synthetic: "Demo",
};

function compact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const loadProfile = cache(getPublicProfile);

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  try {
    const profile = await loadProfile(handle);
    if (!profile) return { title: "Profile not found" };
    const name = profile.name ?? `@${profile.handle}`;
    return {
      title: name,
      description: `${name} has used ${compact(profile.totalTokens)} AI tokens while building — see the tools, models and projects behind it on Token Maxxer.`,
    };
  } catch {
    return { title: "Profile" };
  }
}

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  let profile: Awaited<ReturnType<typeof getPublicProfile>>;
  try {
    profile = await loadProfile(handle);
  } catch {
    return <DatabaseUnavailableNotice />;
  }
  if (!profile) notFound();

  const maxSource = Math.max(1, ...profile.bySource.map((s) => s.tokens));
  const maxModel = Math.max(1, ...profile.byModel.map((m) => m.tokens));
  const b = profile.bucketTotals;

  return (
    <div className="space-y-6">
      {profile.handle.startsWith("demo-") && (
        <Card className="border-purple-200 bg-purple-50 text-sm text-purple-800">
          This is synthetic demo data used to preview the product. It is not real usage.
        </Card>
      )}

      <Card className="relative overflow-hidden p-0">
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-br from-accent-soft via-accent-soft to-transparent" />
        <div className="relative p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-full ring-4 ring-surface">
              <Avatar src={profile.image} alt={profile.name ?? profile.handle} size={72} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{profile.name ?? `@${profile.handle}`}</h1>
              <p className="text-foreground-muted">@{profile.handle}</p>
              {profile.bio && <p className="mt-1 text-sm">{profile.bio}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {profile.publishedAt && (
                <Badge tone="neutral">On the board since {profile.publishedAt.toISOString().slice(0, 10)}</Badge>
              )}
              <CopyLinkButton />
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-foreground-muted">Tokens, all time</div>
              <div className="stat-number text-5xl font-semibold leading-none sm:text-6xl">
                {profile.totalTokens.toLocaleString()}
                {profile.hasUnknownCategories && <span className="ml-1 text-2xl text-accent">*</span>}
              </div>
              <div className="mt-1 text-sm text-foreground-muted">{compact(profile.totalTokens)} processed · headline total</div>
            </div>
            <div className="flex gap-8">
              <Mini label="Models" value={profile.byModel.length} />
              <Mini label="Tools" value={profile.bySource.length} />
              <Mini label="Projects" value={profile.projects.length} />
            </div>
          </div>

          <div className="mt-8 border-t border-border-soft pt-6">
            <h2 className="mb-3 text-sm font-medium text-foreground-muted">Where the tokens went</h2>
            <StackedBar
              segments={[
                { label: "Fresh input", value: b.input, color: BUCKET_COLORS.input },
                { label: "Output", value: b.output, color: BUCKET_COLORS.output },
                { label: "Cache read", value: b.cacheRead, color: BUCKET_COLORS.cacheRead },
                { label: "Cache write", value: b.cacheWrite, color: BUCKET_COLORS.cacheWrite },
              ]}
              footer={
                <p className="mt-3 text-xs text-foreground-muted">
                  Most tokens in agentic coding are cache reads — re-sent context — which is why totals run into the
                  hundreds of millions. Raw volume says nothing about skill or output quality.
                  {profile.hasUnknownCategories && " * Some categories weren't reported by at least one source; unknown is not counted as zero."}
                </p>
              }
            />
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-medium text-foreground-muted">By tool</h2>
          <ul className="space-y-4">
            {profile.bySource.map((s) => (
              <li key={s.source}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    {SOURCE_LABELS[s.source] ?? s.source} <EvidenceBadge level={s.evidenceLevel} />
                  </span>
                  <span className="stat-number font-semibold">{compact(s.tokens)}</span>
                </div>
                <ShareBar value={s.tokens} max={maxSource} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-4 text-sm font-medium text-foreground-muted">By model</h2>
          <ul className="space-y-4">
            {profile.byModel.slice(0, 8).map((m) => (
              <li key={m.model}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-mono text-[13px]">{m.model}</span>
                  <span className="stat-number font-semibold">{compact(m.tokens)}</span>
                </div>
                <ShareBar value={m.tokens} max={maxModel} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-foreground-muted">Projects</h2>
        {profile.projects.length === 0 ? (
          <Card className="text-sm text-foreground-muted">No public projects yet — detected projects stay private until their owner approves them.</Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {profile.projects.map((p) => (
              <Card key={p.id} className="transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium">
                    {p.linkUrl ? (
                      <a href={p.linkUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-border-soft underline-offset-2 hover:decoration-accent">
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
                <p className="stat-number mt-4 text-lg font-semibold">
                  {compact(p.tokens)} <span className="text-sm font-normal text-foreground-muted">tokens</span>
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="stat-number text-2xl font-semibold">{value}</div>
      <div className="text-xs uppercase tracking-wide text-foreground-muted">{label}</div>
    </div>
  );
}
