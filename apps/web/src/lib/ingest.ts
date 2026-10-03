import { computeHeadlineTotal, type ProjectDetectionMethod, type TokenBuckets } from "@token-maxxer/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export interface IngestableEvent {
  source: "claude_code" | "opencode" | "codex" | "synthetic";
  sourceVersion?: string | null; connectorVersion?: string | null; provider?: string | null; model?: string | null;
  sourceEventId: string; replacesSourceEventId?: string;
  eventType: "incremental" | "cumulative_snapshot";
  observedAt: string; periodStart?: string | null; periodEnd?: string | null;
  tokens: TokenBuckets;
  projectFingerprintHash?: string | null; projectDetectionMethod?: ProjectDetectionMethod | null; projectHintRedacted?: string | null; publicRepositoryUrl?: string | null;
}
export interface IngestResult { accepted: number; duplicates: number; unassignedProjects: number; skippedSources?: string[] }
const columns = { input: "inputTokens", output: "outputTokens", cacheRead: "cacheReadTokens", cacheWrite: "cacheWriteTokens", reasoning: "reasoningTokens" } as const;
function tokenColumns(tokens: TokenBuckets) {
  return { inputTokens: tokens.input, outputTokens: tokens.output, cacheReadTokens: tokens.cacheRead,
    cacheWriteTokens: tokens.cacheWrite, reasoningTokens: tokens.reasoning };
}

/** Account-level serialization makes simultaneous retries and two machines reporting the same
 * source event idempotent. PostgreSQL bulk inserts keep history uploads within request limits. */
export async function persistUsageEvents(collectorId: string, userId: string, incoming: IngestableEvent[]): Promise<IngestResult> {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const collector = await tx.collector.findFirst({ where: { id: collectorId, userId, status: "active" } });
    if (!collector) throw new Error("COLLECTOR_REVOKED");
    const byKey = new Map<string, IngestableEvent>();
    for (const event of incoming) {
      const key = `${event.source}:${event.sourceEventId}`;
      const previous = byKey.get(key);
      if (!previous || (new Date(event.observedAt) >= new Date(previous.observedAt) && computeHeadlineTotal(event.tokens) >= computeHeadlineTotal(previous.tokens))) byKey.set(key, event);
    }
    let events = [...byKey.values()];
    const skippedSources: string[] = [];
    if (events.some(e => e.source === "claude_code")) {
      const wantsOtel = events.find(e => e.source === "claude_code")!.connectorVersion?.startsWith("otel-") ?? false;
      const local = await tx.usageEvent.findFirst({ where: { userId, source: "claude_code", OR: [
        { connectorVersion: null }, { connectorVersion: { not: { startsWith: "otel-" } } },
      ] } });
      const telemetry = local ? null : await tx.usageEvent.findFirst({ where: { userId, source: "claude_code", connectorVersion: { startsWith: "otel-" } } });
      if ((wantsOtel && local) || (!wantsOtel && telemetry)) { events = events.filter(e => e.source !== "claude_code"); skippedSources.push("claude_code"); }
    }
    const fingerprints = [...new Set(events.flatMap(e => e.projectFingerprintHash ? [e.projectFingerprintHash] : []))];
    await tx.project.createMany({ data: fingerprints.map(fingerprintHash => {
      const e = events.find(e => e.projectFingerprintHash === fingerprintHash)!;
      return { userId, fingerprintHash, detectionMethod: e.projectDetectionMethod ?? "workspace_folder",
        detectedNameLocal: e.projectHintRedacted ?? "Unnamed project", visibility: "private" };
    }), skipDuplicates: true });
    // Metadata is updated even when the accompanying usage is a duplicate. Discovery must not
    // count tokens again, overwrite an owner-supplied link or change project visibility.
    for (const fingerprintHash of fingerprints) {
      const publicRepositoryUrl = events.find(e => e.projectFingerprintHash === fingerprintHash && e.publicRepositoryUrl !== undefined)?.publicRepositoryUrl;
      if (publicRepositoryUrl !== undefined) await tx.project.updateMany({
        where: { userId, fingerprintHash, mergedIntoId: null }, data: { publicRepositoryUrl },
      });
    }
    const projects = await tx.project.findMany({ where: { userId } });
    const byProjectId = new Map(projects.map(p => [p.id, p]));
    const projectIds = new Map(projects.map(p => {
      let target = p;
      const visited = new Set<string>();
      while (target.mergedIntoId && !visited.has(target.id)) {
        visited.add(target.id); target = byProjectId.get(target.mergedIntoId) ?? target;
      }
      return [p.fingerprintHash, target.id];
    }));
    const existingRows = await tx.usageEvent.findMany({ where: { userId,
      sourceEventId: { in: events.flatMap(e => [e.sourceEventId, ...(e.replacesSourceEventId ? [e.replacesSourceEventId] : [])]) } } });
    const existing = new Map(existingRows.map(r => [`${r.source}:${r.sourceEventId}`, r]));
    const creates: Prisma.UsageEventCreateManyInput[] = [];
    let accepted = 0, duplicates = incoming.length - events.length;
    for (const e of events) {
      if (e.replacesSourceEventId) {
        const old = existing.get(`${e.source}:${e.replacesSourceEventId}`);
        if (old) { await tx.usageEvent.deleteMany({ where: { userId, source: e.source, sourceEventId: e.replacesSourceEventId } }); existing.delete(`${e.source}:${e.replacesSourceEventId}`); }
      }
      const row = { userId, collectorId, projectId: e.projectFingerprintHash ? projectIds.get(e.projectFingerprintHash) ?? null : null,
        source: e.source, sourceVersion: e.sourceVersion ?? null, connectorVersion: e.connectorVersion ?? null,
        provider: e.provider ?? null, model: e.model ?? null, sourceEventId: e.sourceEventId, eventType: e.eventType,
        observedAt: new Date(e.observedAt), periodStart: e.periodStart ? new Date(e.periodStart) : null,
        periodEnd: e.periodEnd ? new Date(e.periodEnd) : null, ...tokenColumns(e.tokens),
        reasoningIncludedInOutput: e.tokens.reasoningIncludedInOutput,
        attributionMethod: e.projectFingerprintHash ? e.projectDetectionMethod ?? "workspace_folder" : "unassigned",
        evidenceLevel: "locally_reported" };
      const previous = existing.get(`${e.source}:${e.sourceEventId}`);
      if (e.eventType === "cumulative_snapshot" && !e.periodEnd && e.connectorVersion?.startsWith("otel-")) {
        const key = { userId_sourceEventId: { userId, sourceEventId: e.sourceEventId } };
        const counter = await tx.usageCounter.findUnique({ where: key });
        const checkpoint = counter ?? previous;
        if (checkpoint && row.observedAt <= checkpoint.observedAt) { duplicates++; continue; }
        const delta = { ...e.tokens };
        const newlyKnown: TokenBuckets = { input: null, output: null, cacheRead: null, cacheWrite: null, reasoning: null,
          reasoningIncludedInOutput: e.tokens.reasoningIncludedInOutput };
        const reset = checkpoint && Object.entries(columns).some(([bucket, column]) => {
          const value = e.tokens[bucket as keyof typeof columns];
          return value !== null && checkpoint[column] !== null && value < checkpoint[column]!;
        });
        for (const [bucket, column] of Object.entries(columns)) {
          const k = bucket as keyof typeof columns;
          if (checkpoint && !reset && checkpoint[column] === null && e.tokens[k] !== null) {
            // This category has no previous baseline, so its historical count cannot be
            // attributed to the current day. Keep it in all-time history separately.
            newlyKnown[k] = e.tokens[k]; delta[k] = null;
          } else delta[k] = e.tokens[k] === null ? null : Math.max(0, e.tokens[k]! - (reset ? 0 : checkpoint?.[column] ?? 0));
        }
        // Old session totals remain in all-time history, with unknown daily attribution. They
        // stop being overwritten; only the difference from that baseline is added going forward.
        if (previous && !counter) await tx.usageEvent.update({ where: { id: previous.id }, data: { periodStart: null, periodEnd: null } });
        await tx.usageCounter.upsert({ where: key, create: { userId, collectorId, sourceEventId: e.sourceEventId,
          observedAt: row.observedAt, ...tokenColumns(e.tokens) }, update: { observedAt: row.observedAt,
          ...Object.fromEntries(Object.entries(tokenColumns(e.tokens)).filter(([, v]) => v !== null)) } });
        if (computeHeadlineTotal(newlyKnown) > 0) creates.push({ ...row, ...tokenColumns(newlyKnown),
          sourceEventId: `${e.sourceEventId}:baseline:${row.observedAt.toISOString()}`, eventType: "cumulative_snapshot", periodStart: null, periodEnd: null });
        if (computeHeadlineTotal(delta) > 0) {
          const firstPeriodKnown = !checkpoint && row.periodStart && row.periodStart.toISOString().slice(0, 10) === row.observedAt.toISOString().slice(0, 10);
          creates.push({ ...row, ...tokenColumns(delta), sourceEventId: `${e.sourceEventId}:reading:${row.observedAt.toISOString()}`,
            eventType: checkpoint || firstPeriodKnown ? "incremental" : "cumulative_snapshot", periodStart: null, periodEnd: null });
        }
        accepted++; continue;
      }
      if (previous) {
        // Ignore stale or less-complete streaming readings; retries must never lower a total.
        if (row.observedAt >= previous.observedAt && computeHeadlineTotal(e.tokens) >= computeHeadlineTotal({ input: previous.inputTokens,
          output: previous.outputTokens, cacheRead: previous.cacheReadTokens, cacheWrite: previous.cacheWriteTokens,
          reasoning: previous.reasoningTokens, reasoningIncludedInOutput: previous.reasoningIncludedInOutput })) {
          const changed = row.observedAt.getTime() !== previous.observedAt.getTime() || row.model !== previous.model || row.projectId !== previous.projectId ||
            Object.values(columns).some(column => row[column] !== previous[column]) || row.periodStart?.getTime() !== previous.periodStart?.getTime();
          if (changed) await tx.usageEvent.update({ where: { id: previous.id }, data: { ...row, collectorId: previous.collectorId } });
        }
        duplicates++;
      } else { creates.push(row); accepted++; }
    }
    if (creates.length) await tx.usageEvent.createMany({ data: creates, skipDuplicates: true });
    return { accepted, duplicates, unassignedProjects: events.filter(e => !e.projectFingerprintHash).length, skippedSources };
  }, { maxWait: 15000, timeout: 55000 });
}
