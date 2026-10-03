import { createReadStream, existsSync, readdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { computeHeadlineTotal, type NormalizedUsageEvent, type TokenBuckets } from "@token-maxxer/shared";
import { codexDesktopFolder, detectProject } from "../project.js";
import type { Connector, ConnectorStatus } from "./types.js";

const CONNECTOR_VERSION = "0.2.0";
const sessionDirs = () => ["sessions", "archived_sessions"].map(name => join(process.env.CODEX_HOME || join(homedir(), ".codex"), name));

export const codexConnector: Connector = {
  source: "codex", displayName: "Codex",
  async detect(): Promise<ConnectorStatus> {
    const { files, compressed } = scanRollouts();
    const count = files.length;
    return { source: "codex", displayName: "Codex", detected: sessionDirs().some(dir => existsSync(dir)),
      status: count ? "ok" : compressed ? "needs_setup" : "unsupported",
      message: (count ? `Found ${count} local Codex session logs.` : "No readable Codex usage logs found yet.") +
        (compressed ? ` ${compressed} compressed log(s) cannot be imported by this collector.` : count ? "" : " Run a Codex session to start tracking.") };
  },
  async collect(projectSalt) {
    async function* allLines() {
      for (const file of scanRollouts().files) {
        try {
          for await (const line of createInterface({ input: createReadStream(file, "utf8"), crlfDelay: Infinity })) yield line;
        } catch { throw new Error("A Codex session could not be read. Its previous uploads are preserved; collection will retry."); }
      }
    }
    // One replay combines disjoint pages of the same thread and deduplicates overlapping
    // retained history before forming complete daily partitions.
    return parseRollout(allLines(), projectSalt);
  },
};

function scanRollouts(): { files: string[]; compressed: number } {
  const out: string[] = [];
  let compressed = 0;
  const walk = (dir: string) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const path = join(dir, e.name);
      if (e.isDirectory()) walk(path);
      else if (e.isFile() && e.name.startsWith("rollout-")) {
        if (e.name.endsWith(".jsonl")) out.push(path);
        else if (e.name.endsWith(".jsonl.zst")) compressed++;
      }
    }
  };
  for (const dir of sessionDirs()) walk(dir);
  return { files: out, compressed };
}

type Usage = { input_tokens?: number; cached_input_tokens?: number; cache_write_input_tokens?: number; output_tokens?: number };
function buckets(total: Usage): TokenBuckets | null {
  if (typeof total.input_tokens !== "number" || typeof total.output_tokens !== "number") return null;
  if (Object.values(total).some(v => typeof v === "number" && (!Number.isSafeInteger(v) || v < 0))) return null;
  const cached = total.cached_input_tokens ?? 0;
  const written = total.cache_write_input_tokens ?? 0;
  if (cached + written > total.input_tokens) return null;
  return { input: total.input_tokens - cached - written, output: total.output_tokens,
    cacheRead: total.cached_input_tokens ?? null, cacheWrite: total.cache_write_input_tokens ?? null,
    reasoning: null, reasoningIncludedInOutput: true };
}

/** Preserve daily/model/project partitions while replaying cumulative counters. No log content
 * leaves this parser. The same complete partition is upserted on subsequent scans. */
export async function parseRollout(lines: AsyncIterable<string>, projectSalt: string): Promise<NormalizedUsageEvent[]> {
  let sessionId: string | null = null, cwd: string | null = null, version: string | null = null, model: string | null = null;
  let desktop = false;
  let previous: Usage | null = null;
  const groups = new Map<string, NormalizedUsageEvent>();
  const seenReadings = new Set<string>();
  for await (const line of lines) {
    if (!line.includes('"session_meta"') && !line.includes('"turn_context"') && !line.includes('"token_count"')) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    const p = o?.payload;
    if (!p || typeof p !== "object") continue;
    if (o.type === "session_meta") {
      previous = null; model = null; cwd = null; version = null;
      desktop = typeof p.originator === "string" && /desktop/i.test(p.originator);
      sessionId = typeof p.id === "string" ? p.id : sessionId;
      cwd = typeof p.cwd === "string" ? p.cwd : cwd;
      version = typeof p.cli_version === "string" ? p.cli_version : version;
    } else if (o.type === "turn_context") {
      model = typeof p.model === "string" ? p.model : model;
      cwd = typeof p.cwd === "string" ? p.cwd : cwd;
    } else if (o.type === "event_msg" && p.type === "token_count" && sessionId && p.info?.total_token_usage) {
      const current = buckets(p.info.total_token_usage);
      const time = new Date(o.timestamp);
      if (!current || !Number.isFinite(time.getTime())) continue;
      const raw: Usage = p.info.total_token_usage;
      const readingKey = JSON.stringify([sessionId, time.toISOString(), raw.input_tokens, raw.output_tokens, raw.cached_input_tokens, raw.cache_write_input_tokens]);
      if (seenReadings.has(readingKey)) { previous = raw; continue; }
      seenReadings.add(readingKey);
      const reset = previous && (raw.input_tokens! < previous.input_tokens! || raw.output_tokens! < previous.output_tokens!);
      const same = previous && ["input_tokens", "output_tokens", "cached_input_tokens", "cache_write_input_tokens"].every(key => raw[key as keyof Usage] === previous![key as keyof Usage]);
      const reported = buckets(p.info.last_token_usage ?? {});
      let delta: TokenBuckets;
      if (same) { previous = raw; continue; }
      if (reported) {
        // The latest completed response is authoritative; cumulative totals can be restored,
        // rewound or re-estimated. Repeated snapshots above still count only once.
        delta = reported;
      } else if (reset) {
        previous = raw;
        continue; // A rewind without per-response usage cannot invent another lifetime total.
      } else {
        const inputDelta = raw.input_tokens! - (previous?.input_tokens ?? 0);
        const readDelta = current.cacheRead === null ? null : Math.min(inputDelta, Math.max(0, current.cacheRead - (previous?.cached_input_tokens ?? 0)));
        const writeDelta = current.cacheWrite === null ? null : Math.min(inputDelta - (readDelta ?? 0), Math.max(0, current.cacheWrite - (previous?.cache_write_input_tokens ?? 0)));
        delta = { ...current, input: inputDelta - (readDelta ?? 0) - (writeDelta ?? 0),
          cacheRead: readDelta, cacheWrite: writeDelta, output: raw.output_tokens! - (previous?.output_tokens ?? 0) };
      }
      previous = raw;
      if (computeHeadlineTotal(delta) === 0) continue;
      const project = cwd ? detectProject(cwd, projectSalt, desktop ? codexDesktopFolder(sessionId, cwd) : undefined) : null;
      const day = time.toISOString().slice(0, 10);
      const partition = createHash("sha256").update(JSON.stringify([model, project?.identityFingerprint ?? null])).digest("hex").slice(0, 24);
      const id = `codex:v2:${sessionId}:${day}:${partition}`;
      let event = groups.get(id);
      if (!event) {
        const start = new Date(`${day}T00:00:00.000Z`);
        event = { source: "codex", sourceVersion: version, connectorVersion: CONNECTOR_VERSION, provider: "openai", model,
          sourceEventId: id, replacesSourceEventId: `codex:${sessionId}`, eventType: "cumulative_snapshot",
          observedAt: time.toISOString(), periodStart: start.toISOString(), periodEnd: new Date(+start + 86400000).toISOString(),
          tokens: { input: 0, output: 0, cacheRead: null, cacheWrite: null, reasoning: null, reasoningIncludedInOutput: true },
          projectFingerprint: project?.folderConfirmed ? project.fingerprintHash : null, projectDetectionMethod: project?.folderConfirmed ? project.detectionMethod : null,
          localProjectHint: project?.folderConfirmed ? project.localHint : null, projectFolderConfirmed: project?.folderConfirmed ?? false, evidenceLevel: "locally_reported" };
        groups.set(id, event);
      }
      for (const key of ["input", "output", "cacheRead", "cacheWrite"] as const) {
        if (delta[key] !== null) event.tokens[key] = (event.tokens[key] ?? 0) + delta[key]!;
      }
      if (time.toISOString() > event.observedAt) event.observedAt = time.toISOString();
    }
  }
  return [...groups.values()];
}
