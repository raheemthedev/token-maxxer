import { formatTokens as compact } from "@/lib/formatTokens";
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
import { ActivityCard, parseRange } from "@/components/ActivityCard";
import { getDailySeriesForHandle } from "@/lib/series";
import Link from "next/link";

const SOURCE_LABELS: Record<string, string> = {
  claude_code: "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
  synthetic: "Demo",
};


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

export default async function ProfilePage({ params, searchParams }: { params: Promise<{ handle: string }>; searchParams: Promise<{ range?: string }> }) {
  const { handle } = await params;
  const range = parseRange((await searchParams).range);
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
  const series = await getDailySeriesForHandle(handle, range).catch(() => null);
  const inputish = b.input + b.cacheRead + b.cacheWrite;
  const cacheShare = inputish > 0 ? Math.round((b.cacheRead / inputish) * 100) : 0;

  return (
    <div className="space-y-6">
      {profile.handle.startsWith("demo-") && (
        <Card className="border-purple-200 bg-purple-50 text-sm text-purple-800">
          This is synthetic demo data used to preview the product. It is not real usage.
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-6">
          <div className="card relative overflow-hidden p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-accent-soft blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-4">
                <div className="rounded-full ring-4 ring-surface">
                  <Avatar src={profile.image} alt={profile.name ?? profile.handle} size={64} />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-2xl font-semibold tracking-tight">{profile.name ?? `@${profile.handle}`}</h1>
                  <p className="text-sm text-foreground-muted">@{profile.handle}</p>
                </div>
                {profile.publishedAt && <Badge tone="neutral">Since {profile.publishedAt.toISOString().slice(0, 10)}</Badge>}
              </div>
              {profile.bio && <p className="mt-4 text-sm">{profile.bio}</p>}

              <div className="eyebrow mt-8">Tokens processed · all time</div>
              <div className="stat-number mt-2 text-5xl font-semibold leading-none sm:text-7xl">
                {compact(profile.totalTokens)}
                {profile.hasUnknownCategories && <span className="ml-1 text-2xl text-accent">*</span>}
              </div>
              <p className="stat-number mt-2 text-sm text-foreground-muted">Tokens across recorded history</p>

              <div className="mt-6 flex flex-wrap gap-3">
                <CopyLinkButton />
                <Link href="/" className="pill pill-light">
                  Leaderboard
                </Link>
              </div>
            </div>
          </div>

          <Card>
            <h2 className="eyebrow mb-4">Where the tokens went</h2>
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
          </Card>
        </div>

        {series ? (
          <ActivityCard
            series={series}
            range={range}
            basePath={`/u/${profile.handle}`}
            rows={[
              { icon: "◐", label: "Cache share of input", value: `${cacheShare}%` },
              { icon: "◍", label: "Models used", value: String(profile.byModel.length) },
              { icon: "▦", label: "Tools", value: String(profile.bySource.length) },
            ]}
          />
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="eyebrow mb-5">By tool</h2>
          <ul className="space-y-5">
            {profile.bySource.map((s) => (
              <li key={s.source}>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
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
          <h2 className="eyebrow mb-5">By model</h2>
          <ul className="space-y-5">
            {profile.byModel.slice(0, 8).map((m) => (
              <li key={m.model}>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
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
        <h2 className="eyebrow mb-3">Projects</h2>
        {profile.projects.length === 0 ? (
          <Card className="text-sm text-foreground-muted">No projects yet. Hidden projects are excluded.</Card>
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
                <p className="stat-number mt-4 text-2xl font-semibold">
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
