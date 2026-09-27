import { execFileSync } from "node:child_process";
import type { NormalizedUsageEvent } from "@token-maxxer/shared";
import { detectProject } from "../project.js";
import type { Connector, ConnectorStatus } from "./types.js";

const CONNECTOR_VERSION = "0.1.0";

/**
 * Reads usage from OpenCode's own `stats` CLI command — deliberately NOT its internal session
 * store/database, since that schema is not a published public API (see docs/SUPPORT_MATRIX.md).
 * This was implemented from documentation review only (no local OpenCode install was available
 * to validate against); it fails closed to `unsupported` rather than guessing at a JSON shape.
 */
export const opencodeConnector: Connector = {
  source: "opencode",
  displayName: "OpenCode",

  async detect(): Promise<ConnectorStatus> {
    if (!isOnPath()) {
      return {
        source: "opencode",
        displayName: "OpenCode",
        detected: false,
        status: "unsupported",
        message: "The `opencode` CLI was not found on PATH.",
      };
    }
    const stats = tryReadStatsJson();
    if (stats === null) {
      return {
        source: "opencode",
        displayName: "OpenCode",
        detected: true,
        status: "needs_setup",
        message:
          "`opencode` is installed, but this collector could not get machine-readable stats from it (validated against docs, not a live install — see docs/SUPPORT_MATRIX.md).",
        setupSteps: [
          "Confirm your OpenCode version supports `opencode stats --json`.",
          "If it doesn't, OpenCode usage can't be collected yet — this is a documented gap, not a configuration problem on your end.",
        ],
      };
    }
    return {
      source: "opencode",
      displayName: "OpenCode",
      detected: true,
      status: "ok",
      message: `Found ${stats.length} session record(s) from \`opencode stats --json\`.`,
    };
  },

  async collect(projectSalt: string): Promise<NormalizedUsageEvent[]> {
    const stats = tryReadStatsJson();
    if (!stats) return [];
    const events: NormalizedUsageEvent[] = [];
    for (const session of stats) {
      const event = normalizeSession(session, projectSalt);
      if (event) events.push(event);
    }
    return events;
  },
};

function isOnPath(): boolean {
  try {
    execFileSync("opencode", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

interface OpenCodeSession {
  id?: string;
  sessionId?: string;
  projectID?: string;
  directory?: string;
  cwd?: string;
  updatedAt?: string;
  timestamp?: string;
  providerID?: string;
  modelID?: string;
  totalTokens?: {
    input?: number;
    output?: number;
    reasoning?: number;
    cache?: { read?: number; write?: number };
  };
}

/** Returns null (not []) when the CLI's output couldn't be trusted as real stats — those are different states. */
function tryReadStatsJson(): OpenCodeSession[] | null {
  try {
    const out = execFileSync("opencode", ["stats", "--json"], {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    });
    const parsed = JSON.parse(out);
    const sessions = Array.isArray(parsed) ? parsed : parsed?.sessions;
    return Array.isArray(sessions) ? sessions : null;
  } catch {
    return null;
  }
}

function normalizeSession(session: OpenCodeSession, projectSalt: string): NormalizedUsageEvent | null {
  const sourceEventId = session.id ?? session.sessionId;
  if (!sourceEventId) return null;

  const cwd = session.directory ?? session.cwd;
  const project = cwd ? detectProject(cwd, projectSalt) : null;
  const tokens = session.totalTokens;

  return {
    source: "opencode",
    sourceVersion: null,
    connectorVersion: CONNECTOR_VERSION,
    provider: session.providerID ?? null,
    model: session.modelID ?? null,
    sourceEventId,
    // OpenCode's stats command reports session-level running totals, so treat each read as a
    // snapshot rather than a delta — the backend keeps the latest snapshot per sourceEventId
    // instead of summing repeated reads together (see docs/ACCOUNTING.md).
    eventType: "cumulative_snapshot",
    observedAt: session.updatedAt ?? session.timestamp ?? new Date().toISOString(),
    periodStart: null,
    periodEnd: null,
    tokens: {
      input: tokens?.input ?? null,
      output: tokens?.output ?? null,
      cacheRead: tokens?.cache?.read ?? null,
      cacheWrite: tokens?.cache?.write ?? null,
      reasoning: tokens?.reasoning ?? null,
      reasoningIncludedInOutput: false,
    },
    projectFingerprint: project?.fingerprintHash ?? null,
    projectDetectionMethod: project?.detectionMethod ?? null,
    localProjectHint: project?.localHint ?? null,
    evidenceLevel: "locally_reported",
  };
}
