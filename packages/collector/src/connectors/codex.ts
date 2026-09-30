import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import { join } from "node:path";
import type { NormalizedUsageEvent } from "@token-maxxer/shared";
import { detectProject } from "../project.js";
import type { Connector, ConnectorStatus } from "./types.js";

const CONNECTOR_VERSION = "0.1.0";
const SESSIONS_DIR = join(homedir(), ".codex", "sessions");

/**
 * Reads Codex CLI rollout logs (~/.codex/sessions/**\/rollout-*.jsonl). Each session logs
 * `token_count` events carrying a CUMULATIVE `total_token_usage`, so one cumulative_snapshot per
 * session (latest reading wins) is emitted. Only session id, cwd, model, timestamps and the token
 * counters are read — never message content.
 *
 * OpenAI semantics differ from Anthropic's: `input_tokens` INCLUDES `cached_input_tokens`, and
 * `output_tokens` INCLUDES reasoning. Buckets are made mutually exclusive here:
 * input = input − cached (− cache_write), cacheRead = cached, output as-is.
 */
export const codexConnector: Connector = {
  source: "codex",
  displayName: "Codex CLI",

  async detect(): Promise<ConnectorStatus> {
    if (!existsSync(SESSIONS_DIR)) {
      return { source: "codex", displayName: "Codex CLI", detected: false, status: "unsupported", message: "No ~/.codex/sessions directory found." };
    }
    const n = listRollouts().length;
    return n === 0
      ? { source: "codex", displayName: "Codex CLI", detected: true, status: "needs_setup", message: "Codex is installed but has no session logs yet.", setupSteps: ["Run a Codex session, then re-run the collector."] }
      : { source: "codex", displayName: "Codex CLI", detected: true, status: "ok", message: `Found ${n} Codex session log(s).` };
  },

  async collect(projectSalt: string): Promise<NormalizedUsageEvent[]> {
    const events: NormalizedUsageEvent[] = [];
    for (const file of listRollouts()) {
      try {
        // Streamed: individual rollout files can be hundreds of MB (past Node's max string size).
        const ev = await parseRollout(createInterface({ input: createReadStream(file, "utf8"), crlfDelay: Infinity }), projectSalt);
        if (ev) events.push(ev);
      } catch (err) {
        console.error(`Codex: could not read one session log (${(err as Error).message}); its usage is NOT counted.`);
      }
    }
    return events;
  },
};

function listRollouts(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(dir, e);
      try {
        if (statSync(p).isDirectory()) walk(p);
        else if (e.startsWith("rollout-") && e.endsWith(".jsonl")) out.push(p);
      } catch {
        /* ignore */
      }
    }
  };
  walk(SESSIONS_DIR);
  return out;
}

interface Usage {
  input_tokens?: number;
  cached_input_tokens?: number;
  cache_write_input_tokens?: number;
  output_tokens?: number;
}

export async function parseRollout(lines: AsyncIterable<string>, projectSalt: string): Promise<NormalizedUsageEvent | null> {
  let sessionId: string | null = null;
  let cwd: string | null = null;
  let version: string | null = null;
  let model: string | null = null;
  let total: Usage | null = null;
  let lastTs: string | null = null;

  for await (const line of lines) {
    // Cheap prefilter: most lines are message/tool content we never need to parse.
    if (!line.includes('"session_meta"') && !line.includes('"turn_context"') && !line.includes('"token_count"')) continue;
    let o: { type?: string; timestamp?: string; payload?: Record<string, unknown> };
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    const p = o.payload ?? {};
    if (o.type === "session_meta") {
      // `id` is per thread; `session_id` is shared with subagent threads that keep their own counters.
      sessionId = (p.id as string) ?? (p.session_id as string) ?? sessionId;
      cwd = (p.cwd as string) ?? cwd;
      version = (p.cli_version as string) ?? version;
    } else if (o.type === "turn_context") {
      model = (p.model as string) ?? model;
      cwd = cwd ?? (p.cwd as string) ?? null;
    } else if (o.type === "event_msg" && p.type === "token_count") {
      const info = p.info as { total_token_usage?: Usage } | null;
      if (info?.total_token_usage) {
        total = info.total_token_usage;
        lastTs = o.timestamp ?? lastTs;
      }
    }
  }
  if (!sessionId || !total) return null;

  const cached = total.cached_input_tokens ?? 0;
  const written = total.cache_write_input_tokens ?? 0;
  const project = cwd ? detectProject(cwd, projectSalt) : null;
  return {
    source: "codex",
    sourceVersion: version,
    connectorVersion: CONNECTOR_VERSION,
    provider: "openai",
    model,
    sourceEventId: `codex:${sessionId}`,
    eventType: "cumulative_snapshot",
    observedAt: lastTs ?? new Date().toISOString(),
    periodStart: null,
    periodEnd: null,
    tokens: {
      input: Math.max(0, (total.input_tokens ?? 0) - cached - written),
      output: total.output_tokens ?? 0,
      cacheRead: cached,
      cacheWrite: written,
      reasoning: null,
      reasoningIncludedInOutput: true,
    },
    projectFingerprint: project?.fingerprintHash ?? null,
    projectDetectionMethod: project?.detectionMethod ?? null,
    localProjectHint: project?.localHint ?? null,
    evidenceLevel: "locally_reported",
  };
}
