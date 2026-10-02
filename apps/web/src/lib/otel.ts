import { hashProjectFingerprint } from "@token-maxxer/shared";
import type { IngestableEvent } from "./ingest";

const CONNECTOR_VERSION = "otel-receiver@0.3.0";

type NumericBucketKey = "input" | "output" | "cacheRead" | "cacheWrite" | "reasoning";

// Claude Code's `claude_code.token.usage` metric attribute values (see docs/SUPPORT_MATRIX.md).
const TYPE_TO_BUCKET: Record<string, NumericBucketKey> = {
  input: "input",
  output: "output",
  cacheRead: "cacheRead",
  cacheCreation: "cacheWrite",
};

const AGG_TEMPORALITY_CUMULATIVE = 2;
// UsageEvent token columns are 32-bit Postgres integers.
const MAX_TOKEN_VALUE = 2_147_483_647;

interface OtlpAttribute {
  key: string;
  value?: {
    stringValue?: string;
    intValue?: string | number;
    doubleValue?: number;
    boolValue?: boolean;
  };
}

function attrString(attributes: OtlpAttribute[] | undefined, key: string): string | undefined {
  const attr = Array.isArray(attributes) ? attributes.find((a) => a && typeof a === "object" && a.key === key) : undefined;
  const v = attr?.value;
  if (!v) return undefined;
  if (typeof v.stringValue === "string") return v.stringValue;
  if (v.intValue !== undefined) return String(v.intValue);
  if (v.doubleValue !== undefined) return String(v.doubleValue);
  if (v.boolValue !== undefined) return String(v.boolValue);
  return undefined;
}

/** Data-point attributes win over resource attributes: Claude Code documents session.id / vcs.* as
 * per-metric attributes, but other exporters put them on the resource — accept either. */
function lookup(pointAttrs: OtlpAttribute[] | undefined, resourceAttrs: OtlpAttribute[] | undefined, key: string) {
  return attrString(pointAttrs, key) ?? attrString(resourceAttrs, key);
}

function dataPointValue(point: { asInt?: string | number; asDouble?: number }): number | null {
  let raw: number | null = null;
  if (point.asInt !== undefined) raw = Number(point.asInt);
  else if (point.asDouble !== undefined) raw = point.asDouble;
  if (raw === null || !Number.isFinite(raw) || raw < 0) return null;
  return Math.round(raw);
}

function nanosToDate(nanos: string | undefined): Date {
  if (!nanos) return new Date();
  try {
    const d = new Date(Number(BigInt(nanos) / BigInt(1_000_000)));
    return Number.isNaN(d.getTime()) ? new Date() : d;
  } catch {
    return new Date();
  }
}

interface GroupedEvent {
  model: string | null;
  observedAt: Date;
  periodStart: string | null;
  eventType: "incremental" | "cumulative_snapshot";
  sourceEventId: string;
  projectFingerprintHash: string | null;
  projectHint: string | null;
  tokens: IngestableEvent["tokens"];
}

export interface OtlpParseResult {
  events: IngestableEvent[];
  /** Short, content-free description of what was received — shown to the user for debugging setup. */
  summary: string;
}

/**
 * Parses an OTLP/HTTP JSON metrics export (Claude Code's `claude_code.token.usage` counter) into
 * our normalized event shape. See docs/ACCOUNTING.md's "OTel receiver" section for how cumulative
 * and delta temporality are handled. Malformed entries are skipped rather than failing the whole
 * batch — this endpoint has no control over what a misconfigured exporter sends.
 *
 * Every distinct attribute combination is its own OTLP time series (e.g. query_source=main vs
 * subagent, fast mode, effort level). All of them are real token usage, so within one row's
 * identity (session, model, project[, timestamp]) their values are summed, never overwritten.
 */
export function parseOtlpMetrics(payload: unknown, projectSalt: string): OtlpParseResult {
  const groups = new Map<string, GroupedEvent>();
  const metricCounts = new Map<string, number>();
  let skippedNoBucket = 0;
  let skippedBadValue = 0;

  const resourceMetrics = (payload as { resourceMetrics?: unknown[] })?.resourceMetrics;
  if (!Array.isArray(resourceMetrics)) {
    return { events: [], summary: "no resourceMetrics in payload" };
  }

  for (const rm of resourceMetrics) {
    if (!rm || typeof rm !== "object") continue;
    const resourceAttrs = (rm as { resource?: { attributes?: OtlpAttribute[] } })?.resource?.attributes;
    const scopeMetrics = (rm as { scopeMetrics?: unknown[] })?.scopeMetrics ?? [];

    if (!Array.isArray(scopeMetrics)) continue;
    for (const sm of scopeMetrics) {
      if (!sm || typeof sm !== "object") continue;
      const metrics = (sm as { metrics?: unknown[] })?.metrics ?? [];
      if (!Array.isArray(metrics)) continue;
      for (const metric of metrics) {
        if (!metric || typeof metric !== "object") continue;
        const m = metric as { name?: string; sum?: { dataPoints?: unknown[]; aggregationTemporality?: number } };
        if (m.name) metricCounts.set(m.name, (metricCounts.get(m.name) ?? 0) + (m.sum?.dataPoints?.length ?? 0));
        if (m.name !== "claude_code.token.usage" || !m.sum || !Array.isArray(m.sum.dataPoints)) continue;
        if (m.sum.aggregationTemporality !== 1 && m.sum.aggregationTemporality !== 2) { skippedBadValue += m.sum.dataPoints.length; continue; }

        const isCumulative = m.sum.aggregationTemporality === AGG_TEMPORALITY_CUMULATIVE;

        for (const dp of m.sum.dataPoints ?? []) {
          if (!dp || typeof dp !== "object") { skippedBadValue++; continue; }
          const point = dp as {
            attributes?: OtlpAttribute[];
            startTimeUnixNano?: string;
            timeUnixNano?: string;
            asInt?: string | number;
            asDouble?: number;
          };

          const type = attrString(point.attributes, "type");
          const bucket = type ? TYPE_TO_BUCKET[type] : undefined;
          if (!bucket) {
            skippedNoBucket += 1;
            continue;
          }
          const value = dataPointValue(point);
          if (value === null || value > MAX_TOKEN_VALUE) {
            skippedBadValue += 1;
            continue;
          }

          const model = lookup(point.attributes, resourceAttrs, "model") ?? null;
          // session.id is the natural counter-reset boundary; without it, a cumulative series' own
          // start time identifies the process lifetime it belongs to.
          const sessionId = lookup(point.attributes, resourceAttrs, "session.id");
          const epoch = sessionId ?? `start-${point.startTimeUnixNano ?? "unknown"}`;

          const owner = lookup(point.attributes, resourceAttrs, "vcs.owner.name");
          const repo = lookup(point.attributes, resourceAttrs, "vcs.repository.name");
          const projectFingerprintHash =
            owner && repo ? hashProjectFingerprint(projectSalt, `${owner}/${repo}`) : null;
          const projectHint = owner && repo ? `${owner}/${repo}` : null;

          if (!point.timeUnixNano || !/^\d+$/.test(String(point.timeUnixNano))) { skippedBadValue++; continue; }
          const observedAt = nanosToDate(point.timeUnixNano);
          if (observedAt.getTime() > Date.now() + 5 * 60 * 1000) { skippedBadValue++; continue; }
          const projectKey = projectFingerprintHash ? projectFingerprintHash.slice(0, 12) : "none";
          const key = isCumulative
            ? `cumulative:${epoch}:${model}:${projectKey}`
            : `delta:${epoch}:${model}:${projectKey}:${point.timeUnixNano}`;

          let group = groups.get(key);
          if (!group) {
            group = {
              model,
              observedAt,
              periodStart: point.startTimeUnixNano ? nanosToDate(point.startTimeUnixNano).toISOString() : null,
              eventType: isCumulative ? "cumulative_snapshot" : "incremental",
              sourceEventId: `otel:${key}`,
              projectFingerprintHash,
              projectHint,
              tokens: {
                input: null,
                output: null,
                cacheRead: null,
                cacheWrite: null,
                reasoning: null,
                // Anthropic doesn't expose reasoning/thinking tokens as a distinct OTel attribute —
                // they're billed as part of output, same as the JSONL connector's assumption.
                reasoningIncludedInOutput: true,
              },
            };
            groups.set(key, group);
          }
          group.tokens[bucket] = (group.tokens[bucket] ?? 0) + value;
          if (observedAt > group.observedAt) group.observedAt = observedAt;
        }
      }
    }
  }

  const events: IngestableEvent[] = [];
  for (const g of groups.values()) {
    // A summed row can still exceed the column range even when each series didn't.
    if (Object.values(g.tokens).some((v) => typeof v === "number" && v > MAX_TOKEN_VALUE)) {
      skippedBadValue += 1;
      continue;
    }
    events.push({
      source: "claude_code",
      sourceVersion: null,
      connectorVersion: CONNECTOR_VERSION,
      provider: "anthropic",
      model: g.model,
      sourceEventId: g.sourceEventId,
      eventType: g.eventType,
      observedAt: g.observedAt.toISOString(),
      periodStart: g.periodStart,
      periodEnd: null,
      projectFingerprintHash: g.projectFingerprintHash,
      projectDetectionMethod: g.projectFingerprintHash ? "session_metadata" : null,
      projectHintRedacted: g.projectHint,
      tokens: g.tokens,
    });
  }

  const seen = Array.from(metricCounts.entries())
    .map(([name, n]) => `${name}×${n}`)
    .join(", ");
  const skipped = [
    skippedNoBucket ? `${skippedNoBucket} without a known type` : "",
    skippedBadValue ? `${skippedBadValue} with invalid values` : "",
  ]
    .filter(Boolean)
    .join(", ");
  const summary =
    `saw ${seen || "no metrics"} → ${events.length} usage event(s)` + (skipped ? `; skipped ${skipped}` : "");

  return { events, summary: summary.slice(0, 300) };
}
