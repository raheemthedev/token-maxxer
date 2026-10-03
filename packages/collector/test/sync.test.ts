import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import type { NormalizedUsageEvent } from "@token-maxxer/shared";

test("Offline uploads survive restart; successful retries deduplicate and idle cycles send a heartbeat", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tmx-sync-")); process.env.TOKEN_MAXXER_HOME = dir;
  const { saveConfig } = await import("../src/config");
  const { collectAndUpload } = await import("../src/sync");
  const { connectors } = await import("../src/diagnostics");
  const original = [...connectors];
  const event: NormalizedUsageEvent = { source: "claude_code", sourceVersion: null, connectorVersion: "test", provider: "anthropic", model: "model",
    sourceEventId: "test-request", eventType: "incremental", observedAt: "2026-09-29T12:00:00Z", periodStart: null, periodEnd: null,
    tokens: { input: 100, output: 20, cacheRead: 0, cacheWrite: 0, reasoning: null, reasoningIncludedInOutput: true },
    projectFingerprint: null, projectDetectionMethod: null, localProjectHint: "folder", evidenceLevel: "locally_reported" };
  connectors.splice(0, connectors.length, { source: "claude_code", displayName: "test", detect: async () => ({ source: "claude_code", displayName: "test", detected: true, status: "ok", message: "Connected" }), collect: async () => [event] });
  connectors.push({ source: "codex", displayName: "broken-tool", detect: async () => { throw new Error("Private local details"); }, collect: async () => [] });
  let offline = true; const batches: { events: unknown[] }[] = [];
  const server = createServer(async (req, res) => {
    if (req.url === "/api/health") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ready: true, accountingVersion: 2, projectDetectionVersion: 2 })); return; }
    assert.equal(req.headers.authorization, "Bearer test-token");
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    assert.ok(!JSON.stringify(body).includes("Private local details"));
    assert.equal(body.connectorStatuses.find((s: { source: string }) => s.source === "codex").status, "error");
    assert.ok(!JSON.stringify(body).includes("localProjectHint")); assert.ok(!JSON.stringify(body).includes("projectFingerprint\""));
    if (offline) { res.writeHead(503, { "content-type": "application/json" }); res.end(JSON.stringify({ error: "Try again" })); return; }
    batches.push(body); res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ accepted: body.events.length, duplicates: 0, unassignedProjects: 0 }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  saveConfig({ serverUrl: `http://127.0.0.1:${port}`, collectorId: "test", collectorName: "test", token: "test-token", projectSalt: "test", pausedAt: null });
  try {
    await assert.rejects(collectAndUpload(), /503/);
    assert.equal(JSON.parse(readFileSync(join(dir, "pending.json"), "utf8")).length, 1);
    offline = false; await collectAndUpload();
    assert.equal(JSON.parse(readFileSync(join(dir, "pending.json"), "utf8")).length, 0);
    await collectAndUpload(); assert.deepEqual(batches.map(b => b.events.length), [1, 0]);
    if (process.platform !== "win32") assert.equal(statSync(join(dir, "config.json")).mode & 0o777, 0o600);
  } finally { connectors.splice(0, connectors.length, ...original); server.close(); rmSync(dir, { recursive: true, force: true }); }
});
