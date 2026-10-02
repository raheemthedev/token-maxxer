import { test, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { persistUsageEvents, type IngestableEvent } from "../src/lib/ingest";
import { getLeaderboard } from "../src/lib/leaderboard";
import { bodySchema } from "../src/lib/ingestSchema";
import { collectorStatus } from "../src/lib/collectorStatus";
import { parseOtlpMetrics } from "../src/lib/otel";
import { getPublicProfile, getPrivateProfilePreview } from "../src/lib/profile";
import { getDailySeries } from "../src/lib/series";
import { POST as pair } from "../src/app/api/collector/pair/route";
import { generatePairingCode, hashCollectorToken } from "../src/lib/collectorAuth";
import { getPeriodBounds } from "../src/lib/period";

const ids: string[] = [];
after(async () => { await prisma.user.deleteMany({ where: { id: { in: ids } } }); await prisma.$disconnect(); });
async function fixture() {
  const user = await prisma.user.create({ data: { handle: `test-${crypto.randomUUID()}` } }); ids.push(user.id);
  const c = await prisma.collector.create({ data: { userId: user.id, name: "test", tokenHash: crypto.randomUUID(), projectSalt: "test" } });
  return { user, c };
}
const event = (overrides: Partial<IngestableEvent> = {}): IngestableEvent => ({ source: "claude_code", connectorVersion: "0.2.0", sourceEventId: "request-1",
  eventType: "incremental", observedAt: new Date().toISOString(), tokens: { input: 100, output: 20, cacheRead: 50, cacheWrite: 0, reasoning: null, reasoningIncludedInOutput: true }, ...overrides });
const total = async (userId: string) => { const rows = await prisma.usageEvent.findMany({ where: { userId } }); return rows.reduce((s, e) => s + (e.inputTokens ?? 0) + (e.outputTokens ?? 0) + (e.cacheReadTokens ?? 0) + (e.cacheWriteTokens ?? 0) + (e.reasoningIncludedInOutput ? 0 : e.reasoningTokens ?? 0), 0); };

test("Simultaneous replay across two collectors is account-idempotent", async () => {
  const { user, c } = await fixture();
  const c2 = await prisma.collector.create({ data: { userId: user.id, name: "second", tokenHash: crypto.randomUUID(), projectSalt: "test" } });
  await Promise.all([persistUsageEvents(c.id, user.id, [event(), event()]), persistUsageEvents(c2.id, user.id, [event()])]);
  assert.equal(await prisma.usageEvent.count({ where: { userId: user.id } }), 1); assert.equal(await total(user.id), 170);
  await persistUsageEvents(c.id, user.id, [event({ tokens: { ...event().tokens, input: 5 } })]); assert.equal(await total(user.id), 170);
});
test("Cumulative telemetry stores deltas in their original day and rejects delayed exports", async () => {
  const { user, c } = await fixture();
  const today = getPeriodBounds("daily").start; const yesterday = new Date(+today - 3600000); const current = new Date(+today + 1000);
  const base = event({ connectorVersion: "otel-receiver@0.3.0", eventType: "cumulative_snapshot", periodStart: new Date(+today - 86400000).toISOString(), observedAt: yesterday.toISOString(), tokens: { input: 100, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: null, reasoningIncludedInOutput: true } });
  await persistUsageEvents(c.id, user.id, [base]);
  await persistUsageEvents(c.id, user.id, [{ ...base, observedAt: current.toISOString(), tokens: { ...base.tokens, input: 300 } }]);
  await persistUsageEvents(c.id, user.id, [base]);
  assert.equal(await total(user.id), 300);
  await prisma.publishSettings.create({ data: { userId: user.id, isPublic: true } });
  const row = (await getLeaderboard("daily")).find(r => r.userId === user.id);
  assert.equal(row?.totalTokens, 200);
  await persistUsageEvents(c.id, user.id, [{ ...base, observedAt: new Date(+current + 1000).toISOString(), tokens: { ...base.tokens, input: 20 } }]);
  assert.equal(await total(user.id), 320);
});
test("A first cross-day cumulative reading is all-time only, never guessed as today", async () => {
  const { user, c } = await fixture();
  await persistUsageEvents(c.id, user.id, [event({ eventType: "cumulative_snapshot", connectorVersion: "otel-receiver@0.3.0", periodStart: "2026-01-01T00:00:00Z" })]);
  await prisma.publishSettings.create({ data: { userId: user.id, isPublic: true } });
  assert.equal(await total(user.id), 170);
  assert.equal((await getLeaderboard("daily")).some(r => r.userId === user.id), false);
});
test("Complete Codex daily partitions replace a legacy session total without double counting", async () => {
  const { user, c } = await fixture();
  await persistUsageEvents(c.id, user.id, [event({ source: "codex", sourceEventId: "codex:session", eventType: "cumulative_snapshot" })]);
  const today = getPeriodBounds("daily").start;
  const partition = event({ source: "codex", sourceEventId: "codex:v2:session:day:model", replacesSourceEventId: "codex:session", eventType: "cumulative_snapshot",
    periodStart: today.toISOString(), periodEnd: new Date(+today + 86400000).toISOString() });
  await persistUsageEvents(c.id, user.id, [partition]); await persistUsageEvents(c.id, user.id, [partition]);
  assert.equal(await total(user.id), 170); assert.equal(await prisma.usageEvent.count({ where: { userId: user.id } }), 1);
});
test("Claude telemetry and transcript collection do not overlap", async () => {
  const { user, c } = await fixture(); await persistUsageEvents(c.id, user.id, [event()]);
  const response = await persistUsageEvents(c.id, user.id, [event({ sourceEventId: "otel:a", connectorVersion: "otel-receiver@0.3.0" })]);
  assert.deepEqual(response.skippedSources, ["claude_code"]); assert.equal(await total(user.id), 170);
});
test("Ingestion enforces dates, integer ranges, private hints and scope", async () => {
  const valid = { collectorName: "test", events: [event()] }; assert.equal(bodySchema.safeParse(valid).success, true);
  for (const invalid of [event({ observedAt: "yesterday" }), event({ tokens: { ...event().tokens, input: -1 } }), event({ tokens: { ...event().tokens, output: 2147483648 } }), event({ projectHintRedacted: "/private/client" }), event({ observedAt: "2099-01-01T00:00:00Z" })]) assert.equal(bodySchema.safeParse({ ...valid, events: [invalid] }).success, false);
  const a = await fixture(), b = await fixture(); await assert.rejects(persistUsageEvents(a.c.id, b.user.id, [event()]), /COLLECTOR_REVOKED/);
  await prisma.collector.update({ where: { id: a.c.id }, data: { status: "revoked" } }); await assert.rejects(persistUsageEvents(a.c.id, a.user.id, [event()]), /COLLECTOR_REVOKED/);
});
test("Malformed nested telemetry never throws; absent temporality is rejected", () => {
  for (const payload of [{ resourceMetrics: [{ scopeMetrics: 42 }] }, { resourceMetrics: [{ scopeMetrics: [null, { metrics: [null, { name: "claude_code.token.usage", sum: { dataPoints: [null] } }] }] }] }]) assert.doesNotThrow(() => parseOtlpMetrics(payload, "test"));
});
test("Collector status distinguishes paired, receiving, stale and revoked", () => {
  assert.equal(collectorStatus({ status: "active", lastSeenAt: null }).label, "Waiting for first upload");
  assert.equal(collectorStatus({ status: "active", lastSeenAt: new Date() }).label, "Receiving uploads");
  assert.equal(collectorStatus({ status: "active", lastSeenAt: new Date(0) }).label, "No recent upload");
  assert.equal(collectorStatus({ status: "revoked", lastSeenAt: new Date() }).label, "Revoked");
});

test("Pairing codes are one-use under concurrency and same-account repair reuses the collector", async () => {
  const { user, c } = await fixture();
  const code = generatePairingCode(); await prisma.pairingCode.create({ data: { code, userId: user.id, expiresAt: new Date(Date.now()+60000) } });
  const request = () => new Request("http://localhost/api/collector/pair", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pairingCode: code, collectorName: "machine" }) });
  const responses = await Promise.all([pair(request()), pair(request())]); assert.deepEqual(responses.map(r => r.status).sort(), [200, 400]);
  const credential = "test-existing-token"; await prisma.collector.update({ where: { id: c.id }, data: { tokenHash: hashCollectorToken(credential) } });
  const secondCode = generatePairingCode(); await prisma.pairingCode.create({ data: { code: secondCode, userId: user.id, expiresAt: new Date(Date.now()+60000) } });
  const repair = await pair(new Request("http://localhost/api/collector/pair", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${credential}` }, body: JSON.stringify({ pairingCode: secondCode, collectorName: "repaired" }) }));
  assert.equal(repair.status, 200); assert.equal((await repair.json()).collectorId, c.id);
});
test("Private preview excludes private project hints and public views require publishing", async () => {
  const { user, c } = await fixture();
  const fingerprint = "a".repeat(64);
  await persistUsageEvents(c.id, user.id, [event({ projectFingerprintHash: fingerprint, projectHintRedacted: "PRIVATE_CLIENT_NAME" })]);
  assert.equal(await getPublicProfile(user.handle!), null);
  const preview = await getPrivateProfilePreview(user.id); assert.equal(preview?.projects.length, 0); assert.ok(!JSON.stringify(preview).includes("PRIVATE_CLIENT_NAME"));
  await prisma.publishSettings.create({ data: { userId: user.id, isPublic: true } });
  assert.equal((await getPublicProfile(user.handle!))?.totalTokens, 170);
});
test("Legacy overlapping Claude methods are excluded consistently without destroying evidence", async () => {
  const { user, c } = await fixture();
  await persistUsageEvents(c.id, user.id, [event()]);
  await prisma.usageEvent.create({ data: { userId: user.id, collectorId: c.id, source: "claude_code", connectorVersion: "otel-receiver@0.2.0", sourceEventId: "old-overlap", eventType: "incremental", observedAt: new Date(), inputTokens: 500, evidenceLevel: "locally_reported", attributionMethod: "unassigned" } });
  await prisma.publishSettings.create({ data: { userId: user.id, isPublic: true } });
  assert.equal((await getPublicProfile(user.handle!))?.totalTokens, 170);
  assert.equal((await getLeaderboard("daily")).find(r=>r.userId===user.id)?.totalTokens, 170);
  assert.equal((await getDailySeries(user.id, 7)).total, 170);
  assert.equal(await prisma.usageEvent.count({where:{userId:user.id}}),2);
  const next = await persistUsageEvents(c.id, user.id, [event({sourceEventId:"next-local"})]); assert.equal(next.accepted,1);
});


test("Newly available cumulative categories are all-time baselines, not invented daily usage", async () => {
  const { user, c } = await fixture();
  const today = getPeriodBounds("daily").start;
  const first = event({ connectorVersion: "otel-receiver@0.3.0", eventType: "cumulative_snapshot", observedAt: new Date(+today - 1000).toISOString(),
    tokens: { input: 100, output: 0, cacheRead: null, cacheWrite: null, reasoning: null, reasoningIncludedInOutput: true } });
  await persistUsageEvents(c.id, user.id, [first]);
  await persistUsageEvents(c.id, user.id, [{ ...first, observedAt: new Date(+today + 1000).toISOString(), tokens: { ...first.tokens, input: 120, cacheRead: 50 } }]);
  await prisma.publishSettings.create({ data: { userId: user.id, isPublic: true } });
  assert.equal(await total(user.id), 170);
  assert.equal((await getLeaderboard("daily")).find(r => r.userId === user.id)?.totalTokens, 20);
});
