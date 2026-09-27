import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashCollectorToken } from "@/lib/collectorAuth";
import { resolveOrCreateProject } from "@/lib/projects";

const tokenBucketsSchema = z.object({
  input: z.number().nullable(),
  output: z.number().nullable(),
  cacheRead: z.number().nullable(),
  cacheWrite: z.number().nullable(),
  reasoning: z.number().nullable(),
  reasoningIncludedInOutput: z.boolean(),
});

const eventSchema = z.object({
  source: z.enum(["claude_code", "opencode", "synthetic"]),
  sourceVersion: z.string().nullable().optional(),
  connectorVersion: z.string().nullable().optional(),
  provider: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  sourceEventId: z.string().min(1),
  eventType: z.enum(["incremental", "cumulative_snapshot"]),
  observedAt: z.string(),
  periodStart: z.string().nullable().optional(),
  periodEnd: z.string().nullable().optional(),
  tokens: tokenBucketsSchema,
  projectFingerprintHash: z.string().nullable().optional(),
  projectDetectionMethod: z.enum(["session_metadata", "git_root", "workspace_folder"]).nullable().optional(),
  projectHintRedacted: z.string().nullable().optional(),
  // Accepted but never trusted verbatim — see note below.
  evidenceLevel: z.enum(["locally_reported", "provider_verified"]).optional(),
});

const bodySchema = z.object({
  collectorName: z.string().min(1).max(100),
  events: z.array(eventSchema).max(2000),
});

/**
 * Authenticated by a paired collector's bearer token (not a user session). A paired collector
 * authenticates who sent the data; it never upgrades evidenceLevel past "locally_reported" — see
 * docs/PRIVACY.md.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
  }

  const collector = await prisma.collector.findUnique({ where: { tokenHash: hashCollectorToken(token) } });
  if (!collector || collector.status !== "active") {
    return NextResponse.json({ error: "Collector token is invalid or revoked." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body.", details: parsed.error.flatten() }, { status: 400 });
  }
  const { collectorName, events } = parsed.data;

  await prisma.collector.update({
    where: { id: collector.id },
    data: { lastSeenAt: new Date(), name: collectorName },
  });

  // Resolve each distinct project fingerprint at most once per request.
  const projectIdByFingerprint = new Map<string, string>();
  for (const event of events) {
    if (!event.projectFingerprintHash || projectIdByFingerprint.has(event.projectFingerprintHash)) continue;
    const projectId = await resolveOrCreateProject(
      collector.userId,
      event.projectFingerprintHash,
      event.projectDetectionMethod ?? "workspace_folder",
      event.projectHintRedacted ?? "Unnamed project",
    );
    projectIdByFingerprint.set(event.projectFingerprintHash, projectId);
  }

  // `createMany({ skipDuplicates: true })` isn't supported on SQLite (only Postgres/MySQL), and we
  // need identical dedup behavior in dev and prod — so idempotency is done with an explicit
  // existence check + upsert instead, which works the same on every provider. A snapshot event
  // (OpenCode) upserting over an existing row is the intended "latest reading wins" behavior; an
  // incremental event (Claude Code) upserting over an existing row means the same request was
  // re-uploaded verbatim, which is a no-op in practice.
  const existing = await prisma.usageEvent.findMany({
    where: {
      collectorId: collector.id,
      sourceEventId: { in: events.map((e) => e.sourceEventId) },
    },
    select: { sourceEventId: true },
  });
  const existingIds = new Set(existing.map((e) => e.sourceEventId));

  let accepted = 0;
  let duplicates = 0;

  for (const event of events) {
    const row = toRow(event, collector.id, collector.userId, projectIdByFingerprint);
    await prisma.usageEvent.upsert({
      where: { collectorId_sourceEventId: { collectorId: collector.id, sourceEventId: event.sourceEventId } },
      create: row,
      update: row,
    });
    if (existingIds.has(event.sourceEventId)) {
      duplicates += 1;
    } else {
      accepted += 1;
    }
  }

  const unassignedProjects = events.filter((e) => !e.projectFingerprintHash).length;

  return NextResponse.json({ accepted, duplicates, unassignedProjects });
}

function toRow(
  event: z.infer<typeof eventSchema>,
  collectorId: string,
  userId: string,
  projectIdByFingerprint: Map<string, string>,
) {
  const projectId = event.projectFingerprintHash
    ? (projectIdByFingerprint.get(event.projectFingerprintHash) ?? null)
    : null;

  return {
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
    // Never trust the collector's own claim of stronger verification (see docs/PRIVACY.md) —
    // this release has no provider-backed verification mechanism at all.
    evidenceLevel: "locally_reported" as const,
  };
}
