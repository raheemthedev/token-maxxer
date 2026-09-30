/**
 * Normalized usage record contract shared by every connector (Claude Code, OpenCode, future
 * sources) and the ingestion API. A connector's job is to map its source-specific shape into
 * this record and nothing else — no prompt text, response text, tool output, or file contents
 * ever belongs in here.
 */

export type UsageSource = "claude_code" | "opencode" | "codex" | "synthetic";

/** Whether a record is a delta since the last observation, or a cumulative snapshot. */
export type UsageEventType = "incremental" | "cumulative_snapshot";

/** How strongly we can vouch for a record's accuracy. Never claim more than this. */
export type EvidenceLevel = "locally_reported" | "provider_verified";

/** How a project was attributed to this usage record. */
export type AttributionMethod =
  | "session_metadata"
  | "git_root"
  | "workspace_folder"
  | "user_assigned"
  | "unassigned";

/** How a project itself was detected, independent of any single usage record. */
export type ProjectDetectionMethod = "session_metadata" | "git_root" | "workspace_folder";

/**
 * Mutually-exclusive token accounting buckets. Sources report categories differently (some
 * fold reasoning into output, some don't; some have no cache concept at all) — every connector
 * must resolve its source's fields into these buckets so buckets never overlap, or leave a
 * bucket `null` (not `0`) when the source doesn't expose it.
 */
export interface TokenBuckets {
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  /** Only set when the source reports reasoning tokens as a distinct, non-overlapping bucket. */
  reasoning: number | null;
  /** True if reasoning tokens are already folded into `output` (so don't add them again). */
  reasoningIncludedInOutput: boolean;
}

export function emptyTokenBuckets(): TokenBuckets {
  return {
    input: null,
    output: null,
    cacheRead: null,
    cacheWrite: null,
    reasoning: null,
    reasoningIncludedInOutput: false,
  };
}

export interface NormalizedUsageEvent {
  source: UsageSource;
  sourceVersion: string | null;
  connectorVersion: string;
  provider: string | null;
  model: string | null;
  /** Stable id from the source used for idempotent ingestion (e.g. API request id, message uuid). */
  sourceEventId: string;
  eventType: UsageEventType;
  observedAt: string; // ISO 8601
  periodStart: string | null;
  periodEnd: string | null;
  tokens: TokenBuckets;
  /**
   * Local-only project fingerprint (e.g. a hash of the git root or working directory). Never
   * uploaded verbatim — the backend only ever sees an opaque project id the user has approved.
   */
  projectFingerprint: string | null;
  projectDetectionMethod: ProjectDetectionMethod | null;
  /** Raw local folder/session name for the collector's own local UI. Never sent to the backend. */
  localProjectHint: string | null;
  evidenceLevel: EvidenceLevel;
}

/**
 * Headline total rule (documented in docs/ACCOUNTING.md): sum every bucket that is populated,
 * treating input / output / cacheRead / cacheWrite / reasoning as mutually exclusive so nothing
 * is double counted — except reasoning when the source already folds it into `output`.
 *
 * A `null` bucket contributes nothing and does NOT mean zero; callers that need to show
 * "some categories unavailable" should check `hasUnknownCategories` separately.
 */
export function computeHeadlineTotal(tokens: TokenBuckets): number {
  let total = 0;
  total += tokens.input ?? 0;
  total += tokens.output ?? 0;
  total += tokens.cacheRead ?? 0;
  total += tokens.cacheWrite ?? 0;
  if (!tokens.reasoningIncludedInOutput) {
    total += tokens.reasoning ?? 0;
  }
  return total;
}

export function hasUnknownCategories(tokens: TokenBuckets): boolean {
  return (
    tokens.input === null ||
    tokens.output === null ||
    tokens.cacheRead === null ||
    tokens.cacheWrite === null
  );
}
