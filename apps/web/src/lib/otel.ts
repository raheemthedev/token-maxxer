import { hashProjectFingerprint } from "@token-maxxer/shared";
import type { IngestableEvent } from "./ingest";

const CONNECTOR_VERSION = "otel-receiver@0.1.0";

type NumericBucketKey = "input" | "output" | "cacheRead" | "cacheWrite" | "reasoning";

// Claude Code's `claude_code.token.usage` metric attribute values (see docs/SUPPORT_MATRIX.md).
const TYPE_TO_BUCKET: Record<string, NumericBucketKey> = {
  input: "input",
  output: "output",
  cacheRead: "cacheRead",
  cacheCreation: "cacheWrite",
};

const AGG_TEMPORALITY_CUMULATIVE = 2;

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
  const attr = attributes?.find((a) => a.key === key);
  const v = attr?.value;
  if (!v) return undefined;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.intValue !== undefined) return String(v.intValue);
  if (v.doubleValue !== undefined) return String(v.doubleValue);
  if (v.boolValue !== undefined) return String(v.boolValue);
  return undefined;
}

function dataPointValue(point: { asInt?: string | number; asDouble?: number }): number | null {
  if (point.asInt !== undefined) return Number(point.asInt);
  if (point.asDouble !== undefined) return point.asDouble;
  return null;
}

function nanosToDate(nanos: string | undefined): Date {
  if (!nanos) return new Date();
  try {
    return new Date(Number(BigInt(nanos) / BigInt(1_000_000)));
  } catch {
    return new Date();
  }
}

interface GroupedEvent {
  sessionId: string;
  model: string | null;
  observedAt: Date;
  eventType: "incremental" | "cumulative_snapshot";
  sourceEventId: string;
  projectFingerprintHash: string | null;
  projectHint: string | null;
  tokens: IngestableEvent["tokens"];
}

/**
 * Parses an OTLP/HTTP JSON metrics export (Claude Code's `claude_code.token.usage` counter) into
 * our normalized event shape. See docs/ACCOUNTING.md's "OTel receiver" section for why cumulative
 * and delta temporality are handled differently, and docs/SUPPORT_MATRIX.md for the attribute
 * names this relies on. Malformed entries are skipped rather than failing the whole batch — this
 * endpoint has no control over what a misconfigured exporter sends.
 */
export function parseOtlpMetrics(payload: unknown, projectSalt: string): IngestableEvent[] {
  const groups = new Map<string, GroupedEvent>();

  const resourceMetrics = (payload as { resourceMetrics?: unknown[] })?.resourceMetrics;
  if (!Array.isArray(resourceMetrics)) return [];

  for (const rm of resourceMetrics) {
    const resource = (rm as { resource?: { attributes?: OtlpAttribute[] } })?.resource;
    const resourceAttrs = resource?.attributes;
    const sessionId = attrString(resourceAttrs, "session.id");
    if (!sessionId) continue; // no stable identity to key events on — skip rather than guess one

    const owner = attrString(resourceAttrs, "vcs.owner.name");
    const repo = attrString(resourceAttrs, "vcs.repository.name");
    const projectFingerprintHash = owner && repo ? hashProjectFingerprint(projectSalt, `${owner}/${repo}`) : null;
    // Shown back to the user in their own dashboard only — never published automatically.
    const projectHint = owner && repo ? `${owner}/${repo}` : null;

    const scopeMetrics = (rm as { scopeMetrics?: unknown[] })?.scopeMetrics ?? [];
    for (const sm of scopeMetrics) {
      const metrics = (sm as { metrics?: unknown[] })?.metrics ?? [];
      for (const metric of metrics) {
        const m = metric as { name?: string; sum?: { dataPoints?: unknown[]; aggregationTemporality?: number } };
        if (m.name !== "claude_code.token.usage" || !m.sum) continue;

        const isCumulative = m.sum.aggregationTemporality === AGG_TEMPORALITY_CUMULATIVE;
        const dataPoints = m.sum.dataPoints ?? [];

        for (const dp of dataPoints) {
          const point = dp as {
            attributes?: OtlpAttribute[];
            timeUnixNano?: string;
            asInt?: string | number;
            asDouble?: number;
          };
          const type = attrString(point.attributes, "type");
          const bucket = type ? TYPE_TO_BUCKET[type] : undefined;
          const value = dataPointValue(point);
          if (!bucket || value === null) continue;

          const model = attrString(point.attributes, "model") ?? null;
          const observedAt = nanosToDate(point.timeUnixNano);

          // Cumulative: one row per (session, model) that later exports overwrite — a session
          // boundary is a natural restart/reset boundary, so summing the last snapshot per
          // session gives the correct grand total without needing to diff against a prior value.
          // Delta: one row per (session, model, timestamp) — each is already a real increment.
          const key = isCumulative
            ? `cumulative:${sessionId}:${model}`
            : `delta:${sessionId}:${model}:${point.timeUnixNano}`;

          let group = groups.get(key);
          if (!group) {
            group = {
              sessionId,
              model,
              observedAt,
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
                // Anthropic doesn't currently expose reasoning/thinking tokens as a distinct OTel
                // attribute — they're billed as part of output, same as the JSONL connector's
                // assumption (see docs/ACCOUNTING.md).
                reasoningIncludedInOutput: true,
              },
            };
            groups.set(key, group);
          }
          group.tokens[bucket] = value;
          if (observedAt > group.observedAt) group.observedAt = observedAt;
        }
      }
    }
  }

  return Array.from(groups.values()).map((g) => ({
    source: "claude_code" as const,
    sourceVersion: null,
    connectorVersion: CONNECTOR_VERSION,
    provider: "anthropic",
    model: g.model,
    sourceEventId: g.sourceEventId,
    eventType: g.eventType,
    observedAt: g.observedAt.toISOString(),
    projectFingerprintHash: g.projectFingerprintHash,
    projectDetectionMethod: g.projectFingerprintHash ? ("session_metadata" as const) : null,
    projectHintRedacted: g.projectHint,
    tokens: g.tokens,
  }));
}
