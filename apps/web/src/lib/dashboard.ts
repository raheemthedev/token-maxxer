import { computeHeadlineTotal, type TokenBuckets } from "@token-maxxer/shared";
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
  projects: DashboardProject[];
  collectors: DashboardCollector[];
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const [user, collectors] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        publishSettings: true,
        projects: { where: { mergedIntoId: null }, orderBy: { createdAt: "desc" } },
        usageEvents: {
          select: {
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

  const tokensByProjectId = new Map<string, number>();
  let totalTokens = 0;
  let unassignedTokens = 0;

  for (const event of user.usageEvents) {
    const buckets: TokenBuckets = {
      input: event.inputTokens,
      output: event.outputTokens,
      cacheRead: event.cacheReadTokens,
      cacheWrite: event.cacheWriteTokens,
      reasoning: event.reasoningTokens,
      reasoningIncludedInOutput: event.reasoningIncludedInOutput,
    };
    const total = computeHeadlineTotal(buckets);
    totalTokens += total;
    if (event.projectId) {
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
    projects: user.projects.map((p) => ({
      id: p.id,
      detectedNameLocal: p.detectedNameLocal,
      displayName: p.displayName,
      visibility: p.visibility,
      hidden: p.hidden,
      linkUrl: p.linkUrl,
      linkLabel: p.linkLabel,
      description: p.description,
      detectionMethod: p.detectionMethod,
      tokens: tokensByProjectId.get(p.id) ?? 0,
    })),
    collectors,
  };
}
