import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { parseRollout } from "../src/connectors/codex";
import { parseTranscriptLine } from "../src/connectors/claudeCode";
import { parseOpenCodeExport } from "../src/connectors/opencode";
import { resetProjectCache } from "../src/project";
import { computeHeadlineTotal } from "@token-maxxer/shared";

test("All connectors require a folder project; desktop chat directories never become projects", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tmx-folders-"));
  const original = process.env.CODEX_HOME;
  process.env.CODEX_HOME = join(dir, "codex");
  const workspace = join(dir, "Real project"), chat = join(dir, "chat-output");
  mkdirSync(workspace); mkdirSync(chat); mkdirSync(process.env.CODEX_HOME);
  execFileSync("git", ["init", workspace], { stdio: "ignore" });
  writeFileSync(join(process.env.CODEX_HOME, ".codex-global-state.json"), JSON.stringify({
    "local-projects": { project: { rootPaths: [workspace] } },
    "thread-project-assignments": { assigned: { projectKind: "local", projectId: "project" } },
    "projectless-thread-ids": ["chat"],
  }));
  const rollout = async (id: string, cwd: string, originator = "Codex Desktop") => {
    async function* lines() {
      yield JSON.stringify({ type: "session_meta", payload: { id, cwd, originator } });
      yield JSON.stringify({ type: "event_msg", timestamp: "2026-09-29T12:00:00Z", payload: { type: "token_count", info: { total_token_usage: { input_tokens: 100, output_tokens: 20 } } } });
    }
    return (await parseRollout(lines(), "salt"))[0];
  };
  const claude = (cwd: string) => parseTranscriptLine(JSON.stringify({ type: "assistant", uuid: "response", cwd,
    timestamp: "2026-09-29T12:00:00Z", message: { usage: { input_tokens: 100, output_tokens: 20 } } }), "salt")!;
  const opencode = (cwd: string) => parseOpenCodeExport({ info: { id: "ses_folder" }, messages: [{ info: {
    id: "msg", role: "assistant", time: { completed: 1790683200000 }, tokens: { input: 100, output: 20 },
  } }] }, "salt", cwd)[0];
  try {
    resetProjectCache();
    const assigned = await rollout("assigned", chat);
    assert.equal(assigned.localProjectHint, "Real project"); assert.equal(assigned.projectFolderConfirmed, true);
    assert.equal((await rollout("chat", workspace)).projectFingerprint, null);
    assert.equal((await rollout("unassigned", chat)).projectFingerprint, null);
    assert.equal((await rollout("cli", workspace, "codex_cli_rs")).projectFolderConfirmed, true);
    for (const parse of [claude, opencode]) {
      assert.equal(parse(workspace).projectFolderConfirmed, true);
      assert.equal(parse(homedir()).projectFingerprint, null);
      assert.equal(parse(join(dir, "missing-folder")).projectFingerprint, null);
      assert.equal(computeHeadlineTotal(parse(homedir()).tokens), 120);
    }
    // Attribution can change without changing a historical Codex event's identity or total.
    const desktop = await rollout("chat", workspace), cli = await rollout("chat", workspace, "codex_cli_rs");
    assert.equal(desktop.sourceEventId, cli.sourceEventId);
    assert.equal(computeHeadlineTotal(desktop.tokens), computeHeadlineTotal(cli.tokens));
  } finally {
    if (original === undefined) delete process.env.CODEX_HOME; else process.env.CODEX_HOME = original;
    resetProjectCache(); rmSync(dir, { recursive: true, force: true });
  }
});
