import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { NormalizedUsageEvent } from "@token-maxxer/shared";
import { detectProject } from "../project.js";
import type { Connector, ConnectorStatus } from "./types.js";

const CONNECTOR_VERSION = "0.1.0";
const PROJECTS_DIR = join(homedir(), ".claude", "projects");

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
    if (!existsSync(PROJECTS_DIR)) {
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
      let raw: string;
      try {
        raw = readFileSync(filePath, "utf8");
      } catch {
        continue; // file may have been rotated/removed mid-scan; skip, not fatal
      }
      for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        const event = parseTranscriptLine(line, projectSalt);
        if (event) events.push(event);
      }
    }
    return events;
  },
};

function listTranscriptFiles(): string[] {
  if (!existsSync(PROJECTS_DIR)) return [];
  const files: string[] = [];
  for (const projectDir of safeReaddir(PROJECTS_DIR)) {
    const fullDir = join(PROJECTS_DIR, projectDir);
    if (!statSync(fullDir).isDirectory()) continue;
    for (const entry of safeReaddir(fullDir)) {
      if (entry.endsWith(".jsonl")) files.push(join(fullDir, entry));
    }
  }
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

function parseTranscriptLine(line: string, projectSalt: string): NormalizedUsageEvent | null {
  let parsed: TranscriptLine;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }

  // Usage numbers only appear on assistant turns.
  if (parsed.type !== "assistant") return null;
  const usage = parsed.message?.usage;
  if (!usage) return null;

  const sourceEventId = parsed.requestId ?? parsed.uuid;
  if (!sourceEventId) return null;

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
