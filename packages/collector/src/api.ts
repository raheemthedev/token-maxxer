import { createHash } from "node:crypto";
import type {
  IngestBatchRequest,
  IngestBatchResponse,
  NormalizedUsageEvent,
  PairingExchangeRequest,
  PairingExchangeResponse,
} from "@token-maxxer/shared";

/** Splits the fields that must never leave the machine from the ones the backend needs. */
function toIngestEvent(event: NormalizedUsageEvent) {
  const { projectFingerprint, localProjectHint } = event;
  // Explicit allowlist: adding a local field can never accidentally leak it in an upload.
  const rest = { source: event.source, sourceVersion: event.sourceVersion, connectorVersion: event.connectorVersion,
    provider: event.provider, model: event.model, sourceEventId: event.sourceEventId, replacesSourceEventId: event.replacesSourceEventId,
    eventType: event.eventType, observedAt: event.observedAt, periodStart: event.periodStart, periodEnd: event.periodEnd,
    tokens: event.tokens, evidenceLevel: "locally_reported", projectDetectionMethod: event.projectDetectionMethod };
  return {
    ...rest,
    projectFingerprintHash: projectFingerprint,
    // Hint is for the user's own dashboard only; truncate defensively even though it's already
    // just a folder basename, never a full path.
    projectHintRedacted: localProjectHint ? localProjectHint.slice(0, 64) : null,
  };
}

export async function exchangePairingCode(
  serverUrl: string,
  req: PairingExchangeRequest,
  previousToken?: string,
): Promise<PairingExchangeResponse> {
  const res = await fetch(new URL("/api/collector/pair", serverUrl), {
    method: "POST",
    signal: AbortSignal.timeout(60000),
    headers: { "content-type": "application/json", ...(previousToken ? { authorization: `Bearer ${previousToken}` } : {}) },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    throw new Error(`Pairing failed (${res.status}): ${await safeText(res)}`);
  }
  return res.json();
}

const verifiedServers = new Map<string, number>();
async function verifyServerAccounting(serverUrl: string) {
  if (Date.now() - (verifiedServers.get(serverUrl) ?? 0) < 60000) return;
  const response = await fetch(new URL("/api/health", serverUrl), { signal: AbortSignal.timeout(15000) });
  const health = await response.json().catch(() => null);
  if (!response.ok || !health?.ready || health.accountingVersion !== 2) {
    throw new Error("The server needs the accounting update before this collector can upload safely. Existing pairing and queued usage are preserved.");
  }
  verifiedServers.set(serverUrl, Date.now());
}

export async function ingestBatch(
  serverUrl: string,
  token: string,
  collectorName: string,
  events: NormalizedUsageEvent[],
  connectorStatuses?: IngestBatchRequest["connectorStatuses"],
): Promise<IngestBatchResponse> {
  await verifyServerAccounting(serverUrl);
  const body: IngestBatchRequest = {
    collectorName,
    connectorStatuses,
    events: events.map(toIngestEvent) as unknown as IngestBatchRequest["events"],
  };
  const res = await fetch(new URL("/api/collector/ingest", serverUrl), {
    method: "POST",
    signal: AbortSignal.timeout(60000),
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Ingest failed (${res.status}): ${await safeText(res)}`);
  }
  return res.json();
}

async function safeText(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return typeof body.error === "string" ? body.error.slice(0, 300) : "Server request failed.";
  } catch {
    return "<no body>";
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
