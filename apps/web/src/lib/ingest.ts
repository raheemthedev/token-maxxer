import { prisma } from "./prisma";
import { resolveOrCreateProject } from "./projects";
import type { ProjectDetectionMethod } from "@token-maxxer/shared";

export interface IngestableEvent {
  source: "claude_code" | "opencode" | "codex" | "synthetic";
  sourceVersion?: string | null;
  connectorVersion?: string | null;
  provider?: string | null;
  model?: string | null;
  sourceEventId: string;
  eventType: "incremental" | "cumulative_snapshot";
  observedAt: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  tokens: {
    input: number | null;
    output: number | null;
    cacheRead: number | null;
    cacheWrite: number | null;
    reasoning: number | null;
    reasoningIncludedInOutput: boolean;
  };
  projectFingerprintHash?: string | null;
  projectDetectionMethod?: ProjectDetectionMethod | null;
  projectHintRedacted?: string | null;
}

export interface IngestResult {
  accepted: number;
  duplicates: number;
  unassignedProjects: number;
}

/**
 * Shared idempotent-upsert persistence used by every ingestion path (CLI collector, OTel
 * receiver). One canonical place for the dedup/project-resolution rules in docs/ACCOUNTING.md so
 * they can't drift between connectors — see that doc before changing this function.
 */
export async function persistUsageEvents(
  collectorId: string,
  userId: string,
  events: IngestableEvent[],
): Promise<IngestResult> {
  if (events.length === 0) {
    return { accepted: 0, duplicates: 0, unassignedProjects: 0 };
  }

  const projectIdByFingerprint = new Map<string, string>();
  for (const event of events) {
    if (!event.projectFingerprintHash || projectIdByFingerprint.has(event.projectFingerprintHash)) continue;
    const projectId = await resolveOrCreateProject(
      userId,
      event.projectFingerprintHash,
      event.projectDetectionMethod ?? "workspace_folder",
      event.projectHintRedacted ?? "Unnamed project",
    );
    projectIdByFingerprint.set(event.projectFingerprintHash, projectId);
  }

  // createMany({ skipDuplicates: true }) isn't portable across providers, so idempotency is an
  // explicit existence check + upsert instead — see the longer note this replaced in git history
  // (apps/web/src/app/api/collector/ingest/route.ts). A cumulative_snapshot upserting over an
  // existing row is "latest reading wins" (by design — see docs/ACCOUNTING.md's OTel section); an
  // incremental event upserting over an existing row means the same request was re-sent verbatim.
  const existing = await prisma.usageEvent.findMany({
    where: { collectorId, sourceEventId: { in: events.map((e) => e.sourceEventId) } },
    select: { sourceEventId: true },
  });
  const existingIds = new Set(existing.map((e) => e.sourceEventId));

  let accepted = 0;
  let duplicates = 0;

  const rows = events.map((event) => {
    const projectId = event.projectFingerprintHash
      ? (projectIdByFingerprint.get(event.projectFingerprintHash) ?? null)
      : null;

    const row = {
      userId,
      collectorId,
      projectId,
      source: event.source,
      sourceVersion: event.sourceVersion ?? null,
      connectorVersion: event.connectorVersion ?? null,
      provider: event.provider ?? null,
      model: event.model ?? null,
      sourceEventId: event.sourceEventId,
      eventType: event.eventType,
      observedAt: new Date(event.observedAt),
      periodStart: event.periodStart ? new Date(event.periodStart) : null,
      periodEnd: event.periodEnd ? new Date(event.periodEnd) : null,
      inputTokens: event.tokens.input,
      outputTokens: event.tokens.output,
      cacheReadTokens: event.tokens.cacheRead,
      cacheWriteTokens: event.tokens.cacheWrite,
      reasoningTokens: event.tokens.reasoning,
      reasoningIncludedInOutput: event.tokens.reasoningIncludedInOutput,
      attributionMethod: projectId ? (event.projectDetectionMethod ?? "workspace_folder") : "unassigned",
      // Never trust a connector's own claim of stronger verification — see docs/PRIVACY.md. This
      // release has no provider-backed verification mechanism at all.
      evidenceLevel: "locally_reported" as const,
    };

    return row;
  });

  // Chunked parallel upserts: a first upload of thousands of events would otherwise be thousands
  // of sequential round trips.
  const CHUNK = 25;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await Promise.all(
      rows.slice(i, i + CHUNK).map((row) =>
        prisma.usageEvent.upsert({
          where: { collectorId_sourceEventId: { collectorId, sourceEventId: row.sourceEventId } },
          create: row,
          update: row,
        }),
      ),
    );
  }
  for (const event of events) {
    if (existingIds.has(event.sourceEventId)) duplicates += 1;
    else accepted += 1;
  }

  const unassignedProjects = events.filter((e) => !e.projectFingerprintHash).length;
  return { accepted, duplicates, unassignedProjects };
}
