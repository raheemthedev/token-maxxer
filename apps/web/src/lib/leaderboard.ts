import { computeHeadlineTotal, hasUnknownCategories, type TokenBuckets } from "@token-maxxer/shared";
import { prisma } from "./prisma";
import { getPeriodBounds, type LeaderboardPeriod } from "./period";

export interface LeaderboardProject {
  displayName: string;
  linkUrl: string | null;
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  handle: string;
  name: string | null;
  image: string | null;
  totalTokens: number;
  hasUnknownCategories: boolean;
  projects: LeaderboardProject[];
}

/**
 * Computes leaderboard totals by summing `computeHeadlineTotal` in JS over each public user's raw
 * usage rows for the period — deliberately the SAME function the accounting docs describe and the
 * collector/ingest path uses, rather than a parallel SQL formula that could silently drift from it.
 * Fine at this data scale; if usage volume grows enough to matter, replace with a materialized
 * per-user/day aggregate table computed with this same function, not a hand-rolled SQL sum.
 */
export async function getLeaderboard(period: LeaderboardPeriod): Promise<LeaderboardRow[]> {
  const { start, end } = getPeriodBounds(period);

  const publicUsers = await prisma.publishSettings.findMany({
    where: { isPublic: true },
    select: {
      userId: true,
      user: {
        select: {
          handle: true,
          name: true,
          image: true,
          projects: {
            where: { visibility: "public", hidden: false, mergedIntoId: null },
            select: { displayName: true, linkUrl: true },
          },
          usageEvents: {
            where: { observedAt: { gte: start, lte: end },
              ...(period === "all_time" ? {} : { OR: [
                { eventType: "incremental" },
                { eventType: "cumulative_snapshot", periodStart: { not: null }, periodEnd: { not: null } },
              ] }),
            },
            select: {
              connectorVersion: true,
              source: true,
              inputTokens: true,
              outputTokens: true,
              cacheReadTokens: true,
              cacheWriteTokens: true,
              reasoningTokens: true,
              reasoningIncludedInOutput: true,
            },
          },
        },
      },
    },
  });

  const localUsers = new Set((await prisma.usageEvent.findMany({
    where: { userId: { in: publicUsers.map(p => p.userId) }, source: "claude_code", OR: [
      { connectorVersion: null }, { connectorVersion: { not: { startsWith: "otel-" } } },
    ] }, select: { userId: true }, distinct: ["userId"],
  })).map(e => e.userId));

  const rows: LeaderboardRow[] = publicUsers
    .filter((p) => p.user.handle)
    .map((p) => {
      let total = 0;
      let unknown = false;
      for (const event of p.user.usageEvents) {
        if (localUsers.has(p.userId) && event.source === "claude_code" && event.connectorVersion?.startsWith("otel-")) continue;
        const buckets: TokenBuckets = {
          input: event.inputTokens,
          output: event.outputTokens,
          cacheRead: event.cacheReadTokens,
          cacheWrite: event.cacheWriteTokens,
          reasoning: event.reasoningTokens,
          reasoningIncludedInOutput: event.reasoningIncludedInOutput,
        };
        total += computeHeadlineTotal(buckets);
        if (hasUnknownCategories(buckets)) unknown = true;
      }
      return {
        rank: 0,
        userId: p.userId,
        handle: p.user.handle as string,
        name: p.user.name,
        image: p.user.image,
        totalTokens: total,
        hasUnknownCategories: unknown,
        projects: p.user.projects
          .filter((proj): proj is { displayName: string; linkUrl: string | null } => Boolean(proj.displayName))
          .map((proj) => ({ displayName: proj.displayName, linkUrl: proj.linkUrl })),
      };
    })
    .filter((row) => row.totalTokens > 0)
    .sort((a, b) => b.totalTokens - a.totalTokens);

  rows.forEach((row, i) => {
    row.rank = i + 1;
  });

  return rows;
}
