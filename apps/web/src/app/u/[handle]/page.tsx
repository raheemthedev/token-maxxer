import { notFound } from "next/navigation";
import { getPublicProfile } from "@/lib/profile";
import { EvidenceBadge } from "@/components/EvidenceBadge";

function formatTokens(n: number): string {
  return n.toLocaleString();
}

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = await getPublicProfile(handle);
  if (!profile) notFound();

  return (
    <div>
      {profile.handle.startsWith("demo-") && (
        <div className="mb-4 rounded-md border border-purple-300 bg-purple-50 p-3 text-sm text-purple-800 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
          This is synthetic demo data used to preview the product. It is not real usage.
        </div>
      )}
      <div className="mb-6 flex items-center gap-4">
        {profile.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.image} alt="" className="h-16 w-16 rounded-full" />
        ) : (
          <span className="h-16 w-16 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        )}
        <div>
          <h1 className="text-2xl font-semibold">{profile.name ?? `@${profile.handle}`}</h1>
          <p className="text-neutral-500">@{profile.handle}</p>
          {profile.bio && <p className="mt-1 text-sm">{profile.bio}</p>}
        </div>
      </div>

      <section className="mb-8 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-neutral-500">Approved aggregate usage (all time)</h2>
          {profile.publishedAt && (
            <span className="text-xs text-neutral-400">
              Published {profile.publishedAt.toISOString().slice(0, 10)}
            </span>
          )}
        </div>
        <p className="font-mono text-3xl">
          {formatTokens(profile.totalTokens)}
          {profile.hasUnknownCategories && <span className="ml-1 text-amber-500">*</span>}
          <span className="ml-2 text-sm font-sans text-neutral-500">tokens (headline total)</span>
        </p>
        {profile.hasUnknownCategories && (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            * Some token categories weren&apos;t reported by at least one connector — not counted
            as zero, just not shown separately.
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          <Bucket label="Input" value={profile.bucketTotals.input} />
          <Bucket label="Output" value={profile.bucketTotals.output} />
          <Bucket label="Cache read" value={profile.bucketTotals.cacheRead} />
          <Bucket label="Cache write" value={profile.bucketTotals.cacheWrite} />
          <Bucket label="Reasoning" value={profile.bucketTotals.reasoning} />
        </div>
      </section>

      <div className="mb-8 grid gap-6 sm:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-medium text-neutral-500">By source</h2>
          <ul className="space-y-1 text-sm">
            {profile.bySource.map((s) => (
              <li key={s.source} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {s.source} <EvidenceBadge level={s.evidenceLevel} />
                </span>
                <span className="font-mono">{formatTokens(s.tokens)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-2 text-sm font-medium text-neutral-500">By model</h2>
          <ul className="space-y-1 text-sm">
            {profile.byModel.map((m) => (
              <li key={m.model} className="flex items-center justify-between">
                <span>{m.model}</span>
                <span className="font-mono">{formatTokens(m.tokens)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-neutral-500">Projects</h2>
        {profile.projects.length === 0 ? (
          <p className="text-sm text-neutral-400">No public projects yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {profile.projects.map((p) => (
              <div key={p.id} className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-medium">
                    {p.linkUrl ? (
                      <a href={p.linkUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline">
                        {p.displayName} ↗
                      </a>
                    ) : (
                      p.displayName
                    )}
                  </h3>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                    {p.linkUrl ? "Project linked" : "Project detected"}
                  </span>
                </div>
                {p.description && <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{p.description}</p>}
                <p className="mt-2 font-mono text-sm">{formatTokens(p.tokens)} tokens</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Bucket({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="font-mono">{value.toLocaleString()}</div>
    </div>
  );
}
