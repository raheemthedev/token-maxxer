import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { opencodeConnector } from "../src/connectors/opencode";
const run = promisify(execFile);
let installed = false;
try { await run("opencode", ["--version"], { timeout: 5000 }); installed = true; } catch { /* optional local capability */ }

test("Installed OpenCode API includes cross-project history and child sessions", { skip: !installed }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "tmx-opencode-test-"));
  const original = { ...process.env };
  const env = { ...process.env, XDG_DATA_HOME: join(dir, "data"), XDG_CONFIG_HOME: join(dir, "config"), XDG_CACHE_HOME: join(dir, "cache"), XDG_STATE_HOME: join(dir, "state"), OPENCODE_DISABLE_AUTOUPDATE: "true" };
  for (const part of ["data", "config", "cache", "state", "repo"]) await mkdir(join(dir, part));
  await run("git", ["init", join(dir, "repo")]);
  Object.assign(process.env, env);
  const time = Date.now() - 60000;
  try {
    assert.equal((await opencodeConnector.detect()).status, "ok");
    for (const [id, parentID] of [["ses_tokenmaxxerparent", undefined], ["ses_tokenmaxxerchild", "ses_tokenmaxxerparent"], ["ses_tokenmaxxerother", undefined]] as const) {
      const fixture = { info: { id, parentID, slug: "synthetic-test", projectID: id.endsWith("other") ? "synthetic-other-project" : "global", directory: join(dir, "repo"), title: "Synthetic test", version: "1.18.30", time: { created: time, updated: time+1000 } }, messages: [{ info: { id: `msg_${id}`, sessionID: id, role: "assistant", modelID: "test-model", providerID: "test-provider", parentID: "msg_parent", mode: "build", agent: "build", path: { cwd: dir, root: dir }, cost: 0, finish: "stop", time: { created: time, completed: time+1000 }, tokens: { input: 100, output: 40, reasoning: 10, cache: { read: 50, write: 20 } } }, parts: [] }] };
      const path = join(dir, `${id}.json`); await writeFile(path, JSON.stringify(fixture));
      await run("opencode", ["import", path], { cwd: join(dir, "repo"), env, timeout: 30000 });
    }
    // More than 500 newer empty sessions with identical timestamps exercise full-history
    // import and avoid accidentally passing against a 100-row or timestamp-cursor limit.
    const schema = JSON.parse((await run("opencode", ["db", "PRAGMA table_info(session)", "--format", "json"], { env })).stdout) as { name: string }[];
    const names = schema.map(c => `"${c.name}"`);
    const select = schema.map(c => c.name === "id" ? "'ses_dummy_' || n" : c.name === "time_updated" ? 'time_updated + 10000' : `"${c.name}"`);
    const sql = `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<501) INSERT INTO session (${names.join(",")}) SELECT ${select.join(",")} FROM session, seq WHERE id='ses_tokenmaxxerchild'`;
    await run("opencode", ["db", sql], { env, timeout: 30000 });
    const events = await opencodeConnector.collect("synthetic-test");
    assert.equal(events.length, 3); assert.equal(events[0].tokens.input, 100);
    assert.ok(events.some(e => e.sourceEventId.includes("ses_tokenmaxxerchild")));
    assert.ok(events.some(e => e.sourceEventId.includes("ses_tokenmaxxerother")));
    assert.ok(events.every(e => e.projectFingerprint));
  } finally {
    for (const key of Object.keys(env)) { if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key]; }
    await rm(dir, { recursive: true, force: true });
  }
});
