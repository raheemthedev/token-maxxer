import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const CONFIG_DIR = process.env.TOKEN_MAXXER_HOME || join(homedir(), ".token-maxxer");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export interface CollectorConfig {
  serverUrl: string;
  collectorId: string;
  collectorName: string;
  /** Long-lived ingestion token. Stored locally with 0600 permissions; never logged. */
  token: string;
  sources?: string[];
  /** Per-user hashing pepper handed back at pairing time. Local-only, never re-uploaded. */
  projectSalt: string;
  pausedAt: string | null;
}

export function configExists(): boolean {
  return existsSync(CONFIG_PATH);
}

export function loadConfig(): CollectorConfig {
  if (!configExists()) {
    throw new Error(
      `No collector config found at ${CONFIG_PATH}. Run \`token-maxxer-collector pair\` first.`,
    );
  }
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as CollectorConfig;
}

export function saveConfig(config: CollectorConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
  try {
    chmodSync(CONFIG_PATH, 0o600);
  } catch {
    // Best effort — not all filesystems support chmod (e.g. some Windows volumes).
  }
}

export function configPath(): string {
  return CONFIG_PATH;
}
