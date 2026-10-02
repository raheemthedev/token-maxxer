export function collectorStatus(collector: { status: string; lastSeenAt: Date | string | null }, now = Date.now()) {
  if (collector.status !== "active") return { label: "Revoked", tone: "neutral" as const, description: "This collector can no longer upload." };
  if (!collector.lastSeenAt) return { label: "Waiting for first upload", tone: "amber" as const, description: "Finish setup on your coding machine. Your first upload will appear here." };
  if (now - +new Date(collector.lastSeenAt) > 15 * 60 * 1000) return { label: "No recent upload", tone: "amber" as const, description: "If your machine is awake, run the collector status command to check tracking. Claude telemetry uploads only while Claude Code is running." };
  return { label: "Receiving uploads", tone: "green" as const, description: "Tracking is connected. New usage appears after the next upload." };
}
