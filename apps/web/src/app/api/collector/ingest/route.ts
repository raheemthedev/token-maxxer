import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashCollectorToken } from "@/lib/collectorAuth";
import { persistUsageEvents } from "@/lib/ingest";

const tokenBucketsSchema = z.object({
  input: z.number().nullable(),
  output: z.number().nullable(),
  cacheRead: z.number().nullable(),
  cacheWrite: z.number().nullable(),
  reasoning: z.number().nullable(),
  reasoningIncludedInOutput: z.boolean(),
});

const eventSchema = z.object({
  source: z.enum(["claude_code", "opencode", "codex", "synthetic"]),
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
 * Authenticated by a paired collector's bearer token (not a user session). Used by the CLI
 * collector (packages/collector); the OTel receiver (/api/otel/v1/metrics) is the other ingestion
 * path and shares the persistence logic in src/lib/ingest.ts. A paired collector authenticates who
 * sent the data; it never upgrades evidenceLevel past "locally_reported" — see docs/PRIVACY.md.
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

  const result = await persistUsageEvents(collector.id, collector.userId, events);
  return NextResponse.json(result);
}
