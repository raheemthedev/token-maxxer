import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NormalizedUsageEvent } from "@token-maxxer/shared";

const dir = mkdtempSync(join(tmpdir(), "tmx-public-links-"));
process.env.TOKEN_MAXXER_HOME = join(dir, "collector");

test("GitHub link discovery accepts public remotes without credentials and rejects unsafe or private matches", async () => {
  const { githubRepositoryUrl, verifyPublicRepository } = await import("../src/publicProjectLinks");
  for (const remote of ["https://github.com/owner/repo.git", "git@github.com:owner/repo.git", "ssh://git@github.com/owner/repo"]) {
    assert.equal(githubRepositoryUrl(remote), "https://github.com/owner/repo");
  }
  for (const remote of ["https://token@github.com/owner/repo", "https://github.com.evil/owner/repo", "https://git.company/owner/repo", "/private/repo", "https://github.com/owner/repo?token=secret", "https://github.com/owner/repo/tree/main"]) {
    assert.equal(githubRepositoryUrl(remote), null);
  }
  const verify = (body: unknown, status = 200) => verifyPublicRepository("https://github.com/owner/repo", (async (url, options) => {
    assert.equal(url, "https://api.github.com/repos/owner/repo");
    assert.equal(new Headers(options?.headers).get("authorization"), null);
    assert.equal(options?.redirect, "error");
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch);
  assert.equal(await verify({ private: false, visibility: "public", full_name: "owner/repo", html_url: "https://github.com/owner/repo" }), "https://github.com/owner/repo");
  for (const body of [null, {}, { private: true }, { private: false, visibility: "public", full_name: "other/repo", html_url: "https://github.com/other/repo" }]) assert.equal(await verify(body), null);
  assert.equal(await verify({}, 404), null);
  assert.equal(await verify({}, 403), null);
  assert.equal(await verifyPublicRepository("https://github.com/owner/repo", (async () => { throw new Error("offline"); }) as typeof fetch), null);
});

test("Discovery caches anonymous checks and exports only verified public repository URLs", async () => {
  const { detectProject, resetProjectCache } = await import("../src/project");
  const { discoverPublicProjectLinks } = await import("../src/publicProjectLinks");
  execFileSync("git", ["init", dir], { stdio: "ignore" });
  execFileSync("git", ["-C", dir, "remote", "add", "origin", "git@github.com:owner/private-repo.git"]);
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (url) => {
    calls++;
    return String(url).endsWith("/private-repo") ? new Response("{}", { status: 404 }) :
      new Response(JSON.stringify({ private: false, visibility: "public", full_name: "owner/public-repo", html_url: "https://github.com/owner/public-repo" }));
  }) as typeof fetch;
  const event = (): NormalizedUsageEvent => ({ source: "codex", sourceVersion: null, connectorVersion: "test", provider: null, model: null,
    sourceEventId: "request", eventType: "incremental", observedAt: new Date().toISOString(), periodStart: null, periodEnd: null,
    tokens: { input: 1, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: null, reasoningIncludedInOutput: true },
    projectFingerprint: detectProject(dir, "salt").fingerprintHash, projectDetectionMethod: "git_root", localProjectHint: "folder", evidenceLevel: "locally_reported" });
  try {
    const privateEvent = event();
    await discoverPublicProjectLinks([privateEvent]);
    assert.equal(privateEvent.publicRepositoryUrl, null);
    assert.ok(!readFileSync(join(dir, "collector/public-links.json"), "utf8").includes("private-repo"));
    await discoverPublicProjectLinks([event()]); assert.equal(calls, 1);
    execFileSync("git", ["-C", dir, "remote", "set-url", "origin", "https://github.com/owner/public-repo.git"]);
    const publicEvent = event(); await discoverPublicProjectLinks([publicEvent]);
    assert.equal(publicEvent.publicRepositoryUrl, "https://github.com/owner/public-repo");
    const cached = event(); await discoverPublicProjectLinks([cached]);
    assert.equal(cached.publicRepositoryUrl, publicEvent.publicRepositoryUrl); assert.equal(calls, 2);
    execFileSync("git", ["-C", dir, "remote", "set-url", "origin", "https://secret@github.com/owner/private-repo"]);
    const credentialRemote = event(); await discoverPublicProjectLinks([credentialRemote]); assert.equal(calls, 2);
    assert.equal(credentialRemote.publicRepositoryUrl, null);
  } finally { globalThis.fetch = originalFetch; resetProjectCache(); rmSync(dir, { recursive: true, force: true }); }
});
