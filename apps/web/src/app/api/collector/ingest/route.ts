import { NextResponse } from "next/server";
import { bodySchema } from "@/lib/ingestSchema";
import { prisma } from "@/lib/prisma";
import { hashCollectorToken } from "@/lib/collectorAuth";
import { persistUsageEvents } from "@/lib/ingest";

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
  const { collectorName, events, connectorStatuses, collectorVersion } = parsed.data;
  if (events.some(e => e.source === "codex" && !e.periodEnd)) {
    return NextResponse.json({ error: "Your collector needs an update. Re-run the install command from your Collector page." }, { status: 409 });
  }
  const result = await persistUsageEvents(collector.id, collector.userId, events);

  await prisma.collector.update({
    where: { id: collector.id },
    data: { lastSeenAt: new Date(), name: collectorName, connectorStatuses, clientVersion: collectorVersion,
      lastIngestSummary: `${result.accepted} new, ${result.duplicates} already seen` + (result.skippedSources?.length ? "; Claude Code already tracked via another method; overlapping uploads skipped" : ""),
    },
  });

  return NextResponse.json(result);
}
