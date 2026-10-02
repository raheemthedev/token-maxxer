import { existsSync, readdirSync, createReadStream, lstatSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { homedir } from "node:os";
import type { NormalizedUsageEvent } from "@token-maxxer/shared";
import { detectProject } from "../project.js";
import type { Connector, ConnectorStatus } from "./types.js";

const CONNECTOR_VERSION = "0.2.0";
const projectsDir = () => join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "projects");

/**
 * Reads Claude Code's local session transcripts (~/.claude/projects/**\/*.jsonl). Each line is a
 * JSON object for one turn of a session. We read ONLY the fields listed below — never
 * `message.content`, tool inputs/outputs, or anything else that could carry prompt/response text.
 * See docs/SUPPORT_MATRIX.md for why this path was chosen over the OTel metrics pipeline.
 */
export const claudeCodeConnector: Connector = {
  source: "claude_code",
  displayName: "Claude Code",

  async detect(): Promise<ConnectorStatus> {
    if (!existsSync(projectsDir())) {
      return {
        source: "claude_code",
        displayName: "Claude Code",
        detected: false,
        status: "unsupported",
        message: "No ~/.claude/projects directory found — Claude Code doesn't appear to be installed or hasn't been run yet.",
      };
    }
    const files = listTranscriptFiles();
    if (files.length === 0) {
      return {
        source: "claude_code",
        displayName: "Claude Code",
        detected: true,
        status: "needs_setup",
        message: "Claude Code is installed, but no session transcripts were found yet.",
        setupSteps: ["Run a Claude Code session, then re-run the collector."],
      };
    }
    return {
      source: "claude_code",
      displayName: "Claude Code",
      detected: true,
      status: "ok",
      message: `Found ${files.length} local session transcript file(s).`,
    };
  },

  async collect(projectSalt: string): Promise<NormalizedUsageEvent[]> {
    const events: NormalizedUsageEvent[] = [];
    for (const filePath of listTranscriptFiles()) {
      try {
        for await (const line of createInterface({ input: createReadStream(filePath, "utf8"), crlfDelay: Infinity })) {
          if (!line.includes('"usage"')) continue;
          const event = parseTranscriptLine(line, projectSalt);
          if (event) events.push(event);
        }
      } catch {
        throw new Error("A Claude Code session could not be read. Collection will retry without discarding past uploads.");
      }
    }
    return events;
  },
};

function listTranscriptFiles(): string[] {
  if (!existsSync(projectsDir())) return [];
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of safeReaddir(dir)) {
      const path = join(dir, entry);
      try {
        const stat = lstatSync(path);
        if (stat.isDirectory()) walk(path);
        else if (stat.isFile() && entry.endsWith(".jsonl")) files.push(path);
      } catch { /* A session may disappear while scanning. */ }
    }
  };
  walk(projectsDir());
  return files;
}

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

interface TranscriptLine {
  type?: string;
  cwd?: string;
  sessionId?: string;
  uuid?: string;
  requestId?: string;
  timestamp?: string;
  version?: string;
  message?: {
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
}

export function parseTranscriptLine(line: string, projectSalt: string): NormalizedUsageEvent | null {
  let parsed: TranscriptLine;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }

  // Usage numbers only appear on assistant turns.
  if (!parsed || typeof parsed !== "object" || parsed.type !== "assistant") return null;
  const usage = parsed.message?.usage;
  if (!usage || typeof usage !== "object") return null;

  const sourceEventId = parsed.requestId ?? parsed.uuid;
  if (!sourceEventId || !parsed.timestamp || !Number.isFinite(new Date(parsed.timestamp).getTime())) return null;
  if ([usage.input_tokens, usage.output_tokens, usage.cache_creation_input_tokens, usage.cache_read_input_tokens].some(v => v != null && (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0))) return null;

  const project = parsed.cwd ? detectProject(parsed.cwd, projectSalt) : null;

  return {
    source: "claude_code",
    sourceVersion: parsed.version ?? null,
    connectorVersion: CONNECTOR_VERSION,
    provider: "anthropic",
    model: parsed.message?.model ?? null,
    sourceEventId,
    eventType: "incremental",
    observedAt: parsed.timestamp ?? new Date().toISOString(),
    periodStart: null,
    periodEnd: null,
    tokens: {
      input: usage.input_tokens ?? null,
      output: usage.output_tokens ?? null,
      cacheRead: usage.cache_read_input_tokens ?? null,
      cacheWrite: usage.cache_creation_input_tokens ?? null,
      // Anthropic does not currently break out extended-thinking tokens as a separate count;
      // they're billed as part of output_tokens. See docs/ACCOUNTING.md.
      reasoning: null,
      reasoningIncludedInOutput: true,
    },
    projectFingerprint: project?.fingerprintHash ?? null,
    projectDetectionMethod: project?.detectionMethod ?? null,
    localProjectHint: project?.localHint ?? null,
    evidenceLevel: "locally_reported",
  };
}
