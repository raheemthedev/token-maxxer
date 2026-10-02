import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { computeHeadlineTotal, type NormalizedUsageEvent } from "@token-maxxer/shared";
import { CONFIG_DIR, loadConfig } from "./config.js";
import { connectors } from "./diagnostics.js";
import { ingestBatch } from "./api.js";
import { resetProjectCache } from "./project.js";

function read<T>(name: string, fallback: T): T {
  try { return JSON.parse(readFileSync(join(CONFIG_DIR, name), "utf8")) as T; } catch { return fallback; }
}
function save(name: string, value: unknown) {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  const path = join(CONFIG_DIR, name);
  writeFileSync(`${path}.tmp`, JSON.stringify(value), { mode: 0o600 }); renameSync(`${path}.tmp`, path);
}
const identity = (e: NormalizedUsageEvent) => `${e.source}:${e.sourceEventId}`;
const digest = (e: NormalizedUsageEvent) => createHash("sha256").update(JSON.stringify(e)).digest("hex");
export function dedupeEvents(events: NormalizedUsageEvent[]) {
  const byId = new Map<string, NormalizedUsageEvent>();
  for (const e of events) {
    const previous = byId.get(identity(e));
    if (!previous || computeHeadlineTotal(e.tokens) >= computeHeadlineTotal(previous.tokens)) byId.set(identity(e), e);
  }
  return [...byId.values()];
}

/** Durable metadata-only outbox. A successful batch is checkpointed before the next request;
 * unacknowledged records survive a crash, offline connection, restart or closed terminal. */
export async function collectAndUpload() {
  const lock = join(CONFIG_DIR, "sync.lock");
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  if (existsSync(lock)) {
    const owner = read<{ pid?: number }>("sync.lock/owner.json", {});
    if (!owner.pid && Date.now() - statSync(lock).mtimeMs < 60000) { console.log("Another collection cycle is starting."); return; }
    if (owner.pid) {
      try { process.kill(owner.pid, 0); console.log("Another collection cycle is already running."); return; } catch { /* stale lock */ }
    }
    rmSync(lock, { recursive: true, force: true });
  }
  try { mkdirSync(lock); } catch { console.log("Another collection cycle is already running."); return; }
  writeFileSync(join(lock, "owner.json"), JSON.stringify({ pid: process.pid }), { mode: 0o600 });
  try {
    const config = loadConfig();
    if (config.pausedAt) { console.log("Collection is paused. Use resume to continue."); return; }
    resetProjectCache();
    const statuses = [];
    let events: NormalizedUsageEvent[] = [];
    for (const connector of connectors) {
      if (config.sources && !config.sources.includes(connector.source)) continue;
      try {
        const status = await connector.detect();
        if (status.status === "ok") events.push(...await connector.collect(config.projectSalt));
        statuses.push({ source: status.source, displayName: status.displayName, status: status.status, message: status.message });
      } catch {
        statuses.push({ source: connector.source, displayName: connector.displayName, status: "error", message: "Could not read this tool's usage. Collection will retry automatically." });
      }
    }
    events = dedupeEvents(events);
    const acknowledged = read<Record<string, string>>("acknowledged.json", {});
    const pending = new Map(read<NormalizedUsageEvent[]>("pending.json", []).map(e => [identity(e), e]));
    for (const e of events) if (acknowledged[identity(e)] !== digest(e)) pending.set(identity(e), e);
    save("pending.json", [...pending.values()]);
    let accepted = 0, duplicates = 0;
    const skippedSources = new Set<string>();
    const queued = [...pending.values()];
    // Always send a heartbeat, even when there are no new tokens. The dashboard can distinguish
    // a healthy idle collector from a service that has stopped running.
    for (let offset = 0; offset < Math.max(queued.length, 1); offset += 250) {
      const batch = queued.slice(offset, offset + 250);
      const result = await ingestBatch(config.serverUrl, config.token, config.collectorName, batch, statuses);
      accepted += result.accepted; duplicates += result.duplicates;
      for (const source of result.skippedSources ?? []) skippedSources.add(source);
      for (const e of batch) { if (result.skippedSources?.includes(e.source)) continue; acknowledged[identity(e)] = digest(e); pending.delete(identity(e)); }
      // A crash between these saves just replays a batch safely.
      save("acknowledged.json", acknowledged); save("pending.json", [...pending.values()]);
    }
    save("sync-status.json", { lastSuccessfulUpload: new Date().toISOString(), accepted, duplicates, skippedSources: [...skippedSources], tools: statuses });
    console.log(`Uploaded successfully. ${accepted} new records, ${duplicates} already seen.`);
    if (skippedSources.size) console.log("Claude Code is already tracked through another method. Overlapping uploads were skipped to prevent duplicate counts.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    save("sync-status.json", { ...read("sync-status.json", {}), lastAttempt: new Date().toISOString(), error: message });
    throw error;
  } finally { rmSync(lock, { recursive: true, force: true }); }
}
