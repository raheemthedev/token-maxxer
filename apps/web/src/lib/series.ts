import { computeHeadlineTotal } from "@token-maxxer/shared";
import { prisma } from "./prisma";

export interface DayPoint {
  date: string; // YYYY-MM-DD (UTC)
  tokens: number;
}

export interface Series {
  points: DayPoint[];
  total: number;
  /** % change of the latest half of the range vs the earlier half; null when there's no baseline. */
  deltaPct: number | null;
  /** Tools whose usage can't be placed on a specific day yet, so they are NOT in this chart. */
  excludedSources: string[];
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Daily token series in UTC. Only events whose time is trustworthy are included: incremental
 * events, and snapshots carrying an explicit period. A running-total snapshot dated at its last
 * reading would pile a whole session onto one day, so those sources are excluded and reported.
 */
export async function getDailySeries(userId: string, days: number): Promise<Series> {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));

  const local = await prisma.usageEvent.findFirst({ where: { userId, source: "claude_code", OR: [
    { connectorVersion: null }, { connectorVersion: { not: { startsWith: "otel-" } } },
  ] }, select: { id: true } });
  const events = await prisma.usageEvent.findMany({
    where: { userId, observedAt: { gte: start, lte: now },
      ...(local ? { NOT: { source: "claude_code", connectorVersion: { startsWith: "otel-" } } } : {}),
    },
    select: {
      source: true,
      eventType: true,
      periodStart: true,
      periodEnd: true,
      observedAt: true,
      inputTokens: true,
      outputTokens: true,
      cacheReadTokens: true,
      cacheWriteTokens: true,
      reasoningTokens: true,
      reasoningIncludedInOutput: true,
    },
  });

  const byDay = new Map<string, number>();
  const excluded = new Set<string>();
  for (const e of events) {
    const trustworthy = e.eventType === "incremental" || (e.periodStart !== null && e.periodEnd !== null);
    if (!trustworthy) {
      excluded.add(e.source);
      continue;
    }
    const key = e.observedAt.toISOString().slice(0, 10);
    byDay.set(
      key,
      (byDay.get(key) ?? 0) +
        computeHeadlineTotal({
          input: e.inputTokens,
          output: e.outputTokens,
          cacheRead: e.cacheReadTokens,
          cacheWrite: e.cacheWriteTokens,
          reasoning: e.reasoningTokens,
          reasoningIncludedInOutput: e.reasoningIncludedInOutput,
        }),
    );
  }

  const points: DayPoint[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(start.getTime() + i * DAY).toISOString().slice(0, 10);
    points.push({ date, tokens: byDay.get(date) ?? 0 });
  }
  const total = points.reduce((a, p) => a + p.tokens, 0);
  const half = Math.floor(days / 2);
  const prev = points.slice(0, half).reduce((a, p) => a + p.tokens, 0);
  const recent = points.slice(half).reduce((a, p) => a + p.tokens, 0);
  return { points, total, deltaPct: prev > 0 ? ((recent - prev) / prev) * 100 : null, excludedSources: Array.from(excluded) };
}

/** Same series for a public profile; returns null unless that user has published. */
export async function getDailySeriesForHandle(handle: string, days: number): Promise<Series | null> {
  const user = await prisma.user.findUnique({
    where: { handle },
    select: { id: true, publishSettings: { select: { isPublic: true } } },
  });
  if (!user?.publishSettings?.isPublic) return null;
  return getDailySeries(user.id, days);
}
