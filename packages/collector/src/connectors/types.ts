import type { NormalizedUsageEvent, UsageSource } from "@token-maxxer/shared";

export interface ConnectorStatus {
  source: UsageSource;
  displayName: string;
  detected: boolean;
  status: "ok" | "needs_setup" | "unsupported";
  /** Human-readable, content-free status message shown in the collector UI/diagnostics. */
  message: string;
  setupSteps?: string[];
}

export interface Connector {
  source: UsageSource;
  displayName: string;
  detect(): Promise<ConnectorStatus>;
  /** Returns every usage record this connector can currently see. Backend dedup makes re-collection safe. */
  collect(projectSalt: string): Promise<NormalizedUsageEvent[]>;
}
