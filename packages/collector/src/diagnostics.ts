import { claudeCodeConnector } from "./connectors/claudeCode.js";
import { opencodeConnector } from "./connectors/opencode.js";
import type { ConnectorStatus } from "./connectors/types.js";

export const connectors = [claudeCodeConnector, opencodeConnector];

/**
 * Content-free status snapshot: tool detection, setup guidance, timestamps. Never includes
 * prompts, code, file contents, or full paths — safe to print, log, or upload as-is.
 */
export async function buildDiagnostics(): Promise<{ generatedAt: string; connectors: ConnectorStatus[] }> {
  const statuses = await Promise.all(connectors.map((c) => c.detect()));
  return { generatedAt: new Date().toISOString(), connectors: statuses };
}
