import { computeHeadlineTotal, hasUnknownCategories, type TokenBuckets } from "@token-maxxer/shared";
import { prisma } from "./prisma";

export interface PublicProfile {
  handle: string;
  name: string | null;
  image: string | null;
  bio: string | null;
  publishedAt: Date | null;
  totalTokens: number;
  hasUnknownCategories: boolean;
  bucketTotals: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    reasoning: number;
  };
  bySource: { source: string; tokens: number; evidenceLevel: string }[];
  byModel: { model: string; tokens: number }[];
  projects: {
    id: string;
    displayName: string;
    description: string | null;
    linkUrl: string | null;
    linkLabel: string | null;
    tokens: number;
  }[];
}

export async function getPublicProfile(handle: string): Promise<PublicProfile | null> {
  const user = await prisma.user.findUnique({
    where: { handle },
    include: {
      publishSettings: true,
      projects: {
        where: { visibility: "public", hidden: false, mergedIntoId: null },
      },
      usageEvents: {
        select: {
          source: true,
          model: true,
          projectId: true,
          evidenceLevel: true,
          inputTokens: true,
          outputTokens: true,
          cacheReadTokens: true,
          cacheWriteTokens: true,
          reasoningTokens: true,
          reasoningIncludedInOutput: true,
        },
      },
    },
  });

  if (!user || !user.handle || !user.publishSettings?.isPublic) return null;

  let totalTokens = 0;
  let unknown = false;
  const bucketTotals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 };
  const bySourceMap = new Map<string, { tokens: number; evidenceLevel: string }>();
  const byModelMap = new Map<string, number>();
  const tokensByProjectId = new Map<string, number>();

  for (const event of user.usageEvents) {
    const buckets: TokenBuckets = {
      input: event.inputTokens,
      output: event.outputTokens,
      cacheRead: event.cacheReadTokens,
      cacheWrite: event.cacheWriteTokens,
      reasoning: event.reasoningTokens,
      reasoningIncludedInOutput: event.reasoningIncludedInOutput,
    };
    const eventTotal = computeHeadlineTotal(buckets);
    totalTokens += eventTotal;
    if (hasUnknownCategories(buckets)) unknown = true;

    bucketTotals.input += buckets.input ?? 0;
    bucketTotals.output += buckets.output ?? 0;
    bucketTotals.cacheRead += buckets.cacheRead ?? 0;
    bucketTotals.cacheWrite += buckets.cacheWrite ?? 0;
    if (!buckets.reasoningIncludedInOutput) bucketTotals.reasoning += buckets.reasoning ?? 0;

    const sourceEntry = bySourceMap.get(event.source) ?? { tokens: 0, evidenceLevel: event.evidenceLevel };
    sourceEntry.tokens += eventTotal;
    bySourceMap.set(event.source, sourceEntry);

    if (event.model) {
      byModelMap.set(event.model, (byModelMap.get(event.model) ?? 0) + eventTotal);
    }

    if (event.projectId) {
      tokensByProjectId.set(event.projectId, (tokensByProjectId.get(event.projectId) ?? 0) + eventTotal);
    }
  }

  return {
    handle: user.handle,
    name: user.name,
    image: user.image,
    bio: user.bio,
    publishedAt: user.publishSettings.publishedAt,
    totalTokens,
    hasUnknownCategories: unknown,
    bucketTotals,
    bySource: Array.from(bySourceMap.entries()).map(([source, v]) => ({ source, ...v })),
    byModel: Array.from(byModelMap.entries())
      .map(([model, tokens]) => ({ model, tokens }))
      .sort((a, b) => b.tokens - a.tokens),
    projects: user.projects
      .filter((p): p is typeof p & { displayName: string } => Boolean(p.displayName))
      .map((p) => ({
        id: p.opaqueId,
        displayName: p.displayName,
        description: p.description,
        linkUrl: p.linkUrl,
        linkLabel: p.linkLabel,
        tokens: tokensByProjectId.get(p.id) ?? 0,
      })),
  };
}
