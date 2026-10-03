import type { NormalizedUsageEvent } from "./usage";

/** Body the collector POSTs to /api/collector/ingest. Batched so a flaky connection can retry safely. */
export interface IngestBatchRequest {
  collectorName: string;
  collectorVersion?: string;
  events: NormalizedIngestEvent[];
  connectorStatuses?: { source: string; displayName: string; status: string; message: string }[];
}

/**
 * What actually crosses the wire: the normalized usage event, minus the two fields that must
 * never leave the machine (`projectFingerprint`, `localProjectHint`), plus the fingerprint's
 * one-way hash so the backend can group events into the same project without learning the path.
 */
export type NormalizedIngestEvent = Omit<
  NormalizedUsageEvent,
  "projectFingerprint" | "localProjectHint"
> & {
  projectFingerprintHash: string | null;
  /** Redacted basename, never a full path. Published accounts show project names without private links. */
  projectHintRedacted: string | null;
};

export interface IngestBatchResponse {
  accepted: number;
  duplicates: number;
  unassignedProjects: number;
  skippedSources?: string[];
}

export interface PairingExchangeRequest {
  pairingCode: string;
  replace?: boolean;
  collectorName: string;
}

export interface PairingExchangeResponse {
  collectorId: string;
  token: string;
  userHandle: string;
  /**
   * Per-user hashing pepper, generated once at first pairing and handed to every collector the
   * user pairs afterward. Used only locally to hash project fingerprints before upload — never
   * logged, never used for anything else. Keeps consistent project grouping across a user's
   * multiple collectors without the backend ever learning real paths.
   */
  projectSalt: string;
}
