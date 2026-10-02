import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTranscriptLine } from "../src/connectors/claudeCode";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codexConnector, parseRollout } from "../src/connectors/codex";
import { parseOpenCodeExport } from "../src/connectors/opencode";
import { computeHeadlineTotal } from "@token-maxxer/shared";
import { serviceDefinition } from "../src/background";

const meta = (id = "thread-1") => ({ type: "session_meta", payload: { id, session_id: "shared-parent", cli_version: "test" } });
const model = (name: string) => ({ type: "turn_context", payload: { model: name } });
const reading = (time: string, input: number, cached = 0, output = 0) => ({ type: "event_msg", timestamp: time,
  payload: { type: "token_count", info: { total_token_usage: { input_tokens: input, cached_input_tokens: cached, output_tokens: output } } } });
async function parse(records: unknown[]) { async function* lines() { for (const record of records) yield JSON.stringify(record); } return parseRollout(lines(), "test"); }

test("Codex preserves day/week and model attribution; repeated counters do not count twice", async () => {
  const events = await parse([meta(), model("a"), reading("2026-09-27T23:59:00Z", 100, 40, 20),
    reading("2026-09-27T23:59:00Z", 100, 40, 20), model("b"), reading("2026-09-28T00:01:00Z", 300, 140, 50)]);
  assert.equal(events.length, 2);
  assert.deepEqual(events.map(e => computeHeadlineTotal(e.tokens)), [120, 230]);
  assert.deepEqual(events.map(e => e.model), ["a", "b"]);
  assert.deepEqual(events.map(e => e.periodStart), ["2026-09-27T00:00:00.000Z", "2026-09-28T00:00:00.000Z"]);
  assert.equal(events[0].tokens.input, 60); assert.equal(events[0].tokens.cacheRead, 40);
  assert.equal(events[0].tokens.cacheWrite, null);
  assert.equal(events[0].replacesSourceEventId, "codex:thread-1");
});
test("Codex partitions replay identically and separates threads sharing a parent session", async () => {
  const records = [meta(), reading("2026-09-29T12:00:00Z", 100)];
  assert.deepEqual(await parse(records), await parse(records));
  assert.notEqual((await parse(records))[0].sourceEventId, (await parse([meta("thread-2"), records[1]]))[0].sourceEventId);
});
test("Codex handles reset counters and ignores invalid metadata", async () => {
  const reset = reading("2026-09-29T13:00:00Z", 20);
  Object.assign(reset.payload.info, { last_token_usage: { input_tokens: 20, output_tokens: 0, cached_input_tokens: 0 } });
  const events = await parse([meta(), reading("2026-09-29T12:00:00Z", 100), reset, reading("2026-09-29T14:00:00Z", -2), reading("invalid", 30)]);
  assert.equal(computeHeadlineTotal(events[0].tokens), 120);
});
test("OpenCode uses completed assistant usage metadata and discards all exported content", () => {
  const exportData = { info: { id: "ses_test", title: "PRIVATE" }, messages: [
    { info: { id: "msg_1", role: "assistant", modelID: "model", providerID: "provider", time: { created: 1790683200000, completed: 1790683201000 }, tokens: { input: 100, output: 40, reasoning: 10, cache: { read: 50, write: 20 } } }, parts: [{ text: "SECRET_PROMPT" }] },
    { info: { id: "msg_2", role: "assistant", time: { created: 1790683200000 }, tokens: { input: 999 } } },
    { info: { id: "msg_3", role: "user", time: { completed: 1790683201000 }, tokens: { input: 999 } } },
  ] };
  const events = parseOpenCodeExport(exportData, "test");
  assert.equal(events.length, 1); assert.equal(computeHeadlineTotal(events[0].tokens), 220);
  assert.equal(events[0].sourceEventId, "opencode:ses_test:msg_1");
  assert.equal(JSON.stringify(events).includes("SECRET"), false); assert.equal(JSON.stringify(events).includes("PRIVATE"), false);
  assert.throws(() => parseOpenCodeExport({ sessions: [] }, "test"));
});
test("Background definitions handle quoted paths and contain no pairing credentials", () => {
  const plist = serviceDefinition("darwin", "/a&b/node", "/home/user name/collector.cjs");
  assert.ok(plist.includes("/a&amp;b/node")); assert.ok(plist.includes("<integer>300</integer>")); assert.ok(!plist.includes("--code"));
  const cron = serviceDefinition("linux", "/usr/bin/node", "/home/it's mine/collector.cjs");
  assert.ok(cron.includes("'\\''")); assert.ok(cron.includes("*/5"));
});

test("Codex keeps inclusive totals accurate when cache details become available", async () => {
  const first = reading("2026-09-29T12:00:00Z", 100);
  delete (first.payload.info.total_token_usage as { cached_input_tokens?: number }).cached_input_tokens;
  const events = await parse([meta(), first, reading("2026-09-30T12:00:00Z", 120, 70)]);
  assert.deepEqual(events.map(e => computeHeadlineTotal(e.tokens)), [100, 20]);
  assert.equal(events[0].tokens.cacheRead, null);
});


test("Claude transcript metadata rejects invalid counts and never exports content", () => {
  const record = { type: "assistant", uuid: "turn-1", timestamp: "2026-09-29T12:00:00Z", message: { content: "PRIVATE_CONTENT", model: "test", usage: { input_tokens: 100, output_tokens: 20 } } };
  const result = parseTranscriptLine(JSON.stringify(record), "test");
  assert.equal(computeHeadlineTotal(result!.tokens), 120);
  assert.equal(JSON.stringify(result).includes("PRIVATE_CONTENT"), false);
  assert.equal(parseTranscriptLine("null", "test"), null);
  assert.equal(parseTranscriptLine(JSON.stringify({ ...record, message: { usage: { input_tokens: "100" } } }), "test"), null);
});


test("Codex imports archived JSONL history and reports unreadable compressed history", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tmx-codex-history-"));
  const original = process.env.CODEX_HOME; process.env.CODEX_HOME = dir;
  try {
    mkdirSync(join(dir, "archived_sessions"));
    writeFileSync(join(dir, "archived_sessions/rollout-archive.jsonl"), [meta("archived-thread"), reading("2026-09-29T12:00:00Z", 100)].map(x => JSON.stringify(x)).join("\n"));
    writeFileSync(join(dir, "archived_sessions/rollout-compressed.jsonl.zst"), "synthetic unreadable fixture");
    assert.equal((await codexConnector.collect("test")).length, 1);
    assert.match((await codexConnector.detect()).message, /1 compressed/);
  } finally {
    if (original === undefined) delete process.env.CODEX_HOME; else process.env.CODEX_HOME = original;
    rmSync(dir, { recursive: true, force: true });
  }
});


test("Codex rewinds count only the latest response and ignore repeated restored counters", async () => {
  const rewind = reading("2026-09-30T12:00:00Z", 900, 800, 40);
  Object.assign(rewind.payload.info, { last_token_usage: { input_tokens: 25, cached_input_tokens: 10, output_tokens: 5 } });
  const events = await parse([meta(), reading("2026-09-29T12:00:00Z", 1000, 900, 50), rewind, rewind, reading("2026-09-30T12:01:00Z", 930, 815, 45)]);
  assert.deepEqual(events.map(e=>computeHeadlineTotal(e.tokens)), [1050, 65]);
});


test("Codex uses explicit latest-response usage when restored cumulative totals jump", async()=>{
 const restored=reading("2026-09-30T12:00:00Z",10000,9000,200);
 Object.assign(restored.payload.info,{last_token_usage:{input_tokens:100,cached_input_tokens:80,output_tokens:5}});
 const events=await parse([meta(),restored,restored]);
 assert.equal(computeHeadlineTotal(events[0].tokens),105);
});


test("Codex joins overlapping retained pages without dropping disjoint responses",async()=>{
 const request=(time:string,input:number)=>{const r=reading(time,input);Object.assign(r.payload.info,{last_token_usage:{input_tokens:100,output_tokens:0,cached_input_tokens:0}});return r;};
 const first=request("2026-09-30T12:00:00Z",100),second=request("2026-09-30T12:01:00Z",200),third=request("2026-09-30T12:02:00Z",300);
 const events=await parse([meta(),first,second,meta(),first,third]);
 assert.equal(events.length,1);assert.equal(computeHeadlineTotal(events[0].tokens),300);
});
