import { canonicalUsage } from "./canonicalUsage";
import { computeHeadlineTotal, hasUnknownCategories, type TokenBuckets } from "@token-maxxer/shared";
import { prisma } from "./prisma";

export interface DashboardProject {
  id: string;
  detectedNameLocal: string;
  displayName: string | null;
  visibility: string;
  hidden: boolean;
  linkUrl: string | null;
  linkLabel: string | null;
  description: string | null;
  detectionMethod: string;
  tokens: number;
}

export interface DashboardCollector {
  id: string;
  name: string;
  status: string;
  lastSeenAt: Date | null;
  createdAt: Date;
}

export interface DashboardData {
  isPublic: boolean;
  publishedAt: Date | null;
  totalTokens: number;
  unassignedTokens: number;
  hasUnknownCategories: boolean;
  bySource: { source: string; tokens: number }[];
  buckets: { input: number; output: number; cacheRead: number; cacheWrite: number };
  projects: DashboardProject[];
  collectors: DashboardCollector[];
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const [user, collectors] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        publishSettings: true,
        projects: { where: { mergedIntoId: null, folderConfirmed: true }, orderBy: { createdAt: "desc" } },
        usageEvents: {
          select: {
            source: true,
          connectorVersion: true,
            projectId: true,
            inputTokens: true,
            outputTokens: true,
            cacheReadTokens: true,
            cacheWriteTokens: true,
            reasoningTokens: true,
            reasoningIncludedInOutput: true,
          },
        },
      },
    }),
    prisma.collector.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
  ]);

  if (!user) throw new Error("User not found");

  const confirmedProjectIds = new Set(user.projects.map(p => p.id));
  const tokensByProjectId = new Map<string, number>();
  let totalTokens = 0;
  let unknown = false;
  let unassignedTokens = 0;
  const sourceTotals = new Map<string, number>();
  const buckets = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

  for (const event of canonicalUsage(user.usageEvents)) {
    const buckets_: TokenBuckets = {
      input: event.inputTokens,
      output: event.outputTokens,
      cacheRead: event.cacheReadTokens,
      cacheWrite: event.cacheWriteTokens,
      reasoning: event.reasoningTokens,
      reasoningIncludedInOutput: event.reasoningIncludedInOutput,
    };
    const total = computeHeadlineTotal(buckets_);
    if (hasUnknownCategories(buckets_)) unknown = true;
    totalTokens += total;
    sourceTotals.set(event.source, (sourceTotals.get(event.source) ?? 0) + total);
    buckets.input += buckets_.input ?? 0;
    buckets.output += buckets_.output ?? 0;
    buckets.cacheRead += buckets_.cacheRead ?? 0;
    buckets.cacheWrite += buckets_.cacheWrite ?? 0;
    if (event.projectId && confirmedProjectIds.has(event.projectId)) {
      tokensByProjectId.set(event.projectId, (tokensByProjectId.get(event.projectId) ?? 0) + total);
    } else {
      unassignedTokens += total;
    }
  }

  return {
    isPublic: user.publishSettings?.isPublic ?? false,
    publishedAt: user.publishSettings?.publishedAt ?? null,
    totalTokens,
    unassignedTokens,
    hasUnknownCategories: unknown,
    bySource: Array.from(sourceTotals.entries()).map(([source, tokens]) => ({ source, tokens })).sort((a, b) => b.tokens - a.tokens),
    buckets,
    projects: user.projects.map((p) => ({
      id: p.id,
      detectedNameLocal: p.detectedNameLocal,
      displayName: p.displayName,
      visibility: p.visibility,
      hidden: p.hidden,
      linkUrl: p.linkUrl ?? p.publicRepositoryUrl,
      linkLabel: p.linkLabel,
      description: p.description,
      detectionMethod: p.detectionMethod,
      tokens: tokensByProjectId.get(p.id) ?? 0,
    })),
    collectors,
  };
}
