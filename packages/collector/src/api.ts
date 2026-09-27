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
  const { projectFingerprint, localProjectHint, ...rest } = event;
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
): Promise<PairingExchangeResponse> {
  const res = await fetch(new URL("/api/collector/pair", serverUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    throw new Error(`Pairing failed (${res.status}): ${await safeText(res)}`);
  }
  return res.json();
}

export async function ingestBatch(
  serverUrl: string,
  token: string,
  collectorName: string,
  events: NormalizedUsageEvent[],
): Promise<IngestBatchResponse> {
  const body: IngestBatchRequest = {
    collectorName,
    events: events.map(toIngestEvent) as unknown as IngestBatchRequest["events"],
  };
  const res = await fetch(new URL("/api/collector/ingest", serverUrl), {
    method: "POST",
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
    return await res.text();
  } catch {
    return "<no body>";
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
