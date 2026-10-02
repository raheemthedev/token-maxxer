import { claudeCodeConnector } from "./connectors/claudeCode.js";
import { opencodeConnector } from "./connectors/opencode.js";
import { codexConnector } from "./connectors/codex.js";
import type { ConnectorStatus } from "./connectors/types.js";

export const connectors = [claudeCodeConnector, codexConnector, opencodeConnector];

/**
 * Content-free status snapshot: tool detection, setup guidance, timestamps. Never includes
 * prompts, code, file contents, or full paths — safe to print, log, or upload as-is.
 */
export async function buildDiagnostics(): Promise<{ generatedAt: string; connectors: ConnectorStatus[] }> {
  const statuses = await Promise.all(connectors.map(async c => {
    try { return await c.detect(); }
    catch { return { source: c.source, displayName: c.displayName, detected: false, status: "error" as const,
      message: "Tool detection failed. Other supported tools can still upload." }; }
  }));
  return { generatedAt: new Date().toISOString(), connectors: statuses };
}
