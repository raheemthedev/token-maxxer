import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashCollectorToken } from "@/lib/collectorAuth";
import { persistUsageEvents } from "@/lib/ingest";
import { parseOtlpMetrics } from "@/lib/otel";

/**
 * OTLP/HTTP (JSON) metrics receiver for Claude Code's built-in telemetry export
 * (`CLAUDE_CODE_ENABLE_TELEMETRY=1` + `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` pointed here). This is
 * the "paste a snippet once, it just works forever" path — no CLI to run or keep alive, unlike
 * packages/collector. See docs/SUPPORT_MATRIX.md for why OTLP/protobuf and gRPC aren't supported
 * (only JSON, to avoid a protobuf dependency) and docs/ACCOUNTING.md for the delta/cumulative
 * handling in src/lib/otel.ts.
 *
 * Authenticated the same way as /api/collector/ingest: a paired collector's bearer token in the
 * `Authorization` header (set via `OTEL_EXPORTER_OTLP_HEADERS`). Never upgrades evidenceLevel past
 * "locally_reported" — see docs/PRIVACY.md.
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

  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or missing JSON body." }, { status: 400 });
  }

  const events = parseOtlpMetrics(payload, collector.projectSalt);

  await prisma.collector.update({
    where: { id: collector.id },
    data: { lastSeenAt: new Date() },
  });

  if (events.length === 0) {
    // A valid, empty (or non-token-usage) export is not an error — OTel exporters send on a
    // fixed interval regardless of whether there's anything new to report.
    return NextResponse.json({ accepted: 0, duplicates: 0, unassignedProjects: 0 });
  }

  const result = await persistUsageEvents(collector.id, collector.userId, events);
  return NextResponse.json(result);
}
