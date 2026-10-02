import { z } from "zod";
const count = z.number().int().min(0).max(2147483647).nullable();
const timestamp = z.iso.datetime({ offset: true });
export const eventSchema = z.object({
  source: z.enum(["claude_code", "opencode", "codex"]),
  sourceVersion: z.string().max(100).nullable().optional(), connectorVersion: z.string().max(100).nullable().optional(),
  provider: z.string().max(100).nullable().optional(), model: z.string().max(200).nullable().optional(),
  sourceEventId: z.string().min(1).max(500), replacesSourceEventId: z.string().max(500).optional(),
  eventType: z.enum(["incremental", "cumulative_snapshot"]), observedAt: timestamp,
  periodStart: timestamp.nullable().optional(), periodEnd: timestamp.nullable().optional(),
  tokens: z.object({ input: count, output: count, cacheRead: count, cacheWrite: count, reasoning: count, reasoningIncludedInOutput: z.boolean() }),
  projectFingerprintHash: z.string().regex(/^[a-f0-9]{64}$/).nullable().optional(),
  projectDetectionMethod: z.enum(["session_metadata", "git_root", "workspace_folder"]).nullable().optional(),
  projectHintRedacted: z.string().max(64).refine(s => !/[\\/\r\n]/.test(s), "Project hint must be a folder name, not a path.").nullable().optional(),
  evidenceLevel: z.enum(["locally_reported", "provider_verified"]).optional(),
}).superRefine((e, ctx) => {
  if (+new Date(e.observedAt) > Date.now() + 300000) ctx.addIssue({ code: "custom", path: ["observedAt"], message: "Usage cannot be in the future." });
  if (e.periodEnd && (!e.periodStart || +new Date(e.periodEnd) <= +new Date(e.periodStart) ||
      +new Date(e.observedAt) < +new Date(e.periodStart) || +new Date(e.observedAt) >= +new Date(e.periodEnd))) {
    ctx.addIssue({ code: "custom", path: ["periodEnd"], message: "Invalid usage period." });
  }
  if (e.replacesSourceEventId && (e.source !== "codex" || !e.sourceEventId.startsWith("codex:v2:") || !e.replacesSourceEventId.startsWith("codex:") || !e.periodEnd)) {
    ctx.addIssue({ code: "custom", path: ["replacesSourceEventId"], message: "Invalid history replacement." });
  }
});
export const bodySchema = z.object({
  collectorName: z.string().min(1).max(100), events: z.array(eventSchema).max(500),
  connectorStatuses: z.array(z.object({ source: z.enum(["claude_code", "codex", "opencode"]),
    displayName: z.string().max(80), status: z.enum(["ok", "needs_setup", "unsupported", "error"]), message: z.string().max(300),
  })).max(3).optional(),
});
