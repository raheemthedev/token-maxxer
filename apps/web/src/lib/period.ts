export type LeaderboardPeriod = "daily" | "weekly" | "all_time";

/**
 * Published rule: all period boundaries are computed in UTC. The week starts Monday 00:00 UTC.
 * This is the exact rule shown on the leaderboard page — if you change it here, update the copy
 * in src/app/page.tsx too.
 */
export function getPeriodBounds(period: LeaderboardPeriod, now: Date = new Date()): { start: Date; end: Date } {
  const end = now;
  if (period === "all_time") {
    return { start: new Date(0), end };
  }
  if (period === "daily") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return { start, end };
  }
  // weekly: Monday 00:00 UTC of the current week.
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday));
  return { start, end };
}
