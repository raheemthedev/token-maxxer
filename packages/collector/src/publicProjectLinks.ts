import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { NormalizedUsageEvent } from "@token-maxxer/shared";
import { CONFIG_DIR } from "./config.js";
import { projectRoots } from "./project.js";

const publicUrl = /^https:\/\/github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/;
type Cache = Record<string, { checkedAt: number; url: string | null }>;

/** Accept only standard GitHub remotes. Credentials, enterprise hosts, paths and queries are
 * rejected locally; they are never sent to Token Maxxer or followed over the network. */
export function githubRepositoryUrl(remote: string): string | null {
  const match = /^(?:git@github\.com:|https:\/\/github\.com\/|ssh:\/\/git@github\.com\/)([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/.exec(remote.trim());
  return match ? `https://github.com/${match[1]}/${match[2]}` : null;
}

/** A failed lookup is optional metadata, never a reason to block token collection. */
export async function verifyPublicRepository(url: string, request: typeof fetch = fetch): Promise<string | null> {
  if (!publicUrl.test(url)) return null;
  const fullName = url.slice("https://github.com/".length);
  try {
    const response = await request(`https://api.github.com/repos/${fullName}`, {
      headers: { accept: "application/vnd.github+json", "user-agent": "Token-Maxxer-Collector" },
      redirect: "error", signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return null;
    const repo = await response.json();
    return repo.private === false && repo.visibility === "public" &&
      typeof repo.full_name === "string" && repo.full_name.toLowerCase() === fullName.toLowerCase() &&
      typeof repo.html_url === "string" && repo.html_url.toLowerCase() === url.toLowerCase()
      ? repo.html_url : null;
  } catch { return null; }
}

export async function discoverPublicProjectLinks(events: NormalizedUsageEvent[]) {
  const path = join(CONFIG_DIR, "public-links.json");
  let cache: Cache = {};
  try {
    const saved = JSON.parse(readFileSync(path, "utf8"));
    if (saved && typeof saved === "object" && !Array.isArray(saved)) cache = saved;
  } catch { /* first scan */ }
  const started = Date.now();
  let lookups = 0;
  const links = new Map<string, string | null>();
  for (const [fingerprint, root] of projectRoots) {
    if (!events.some(e => e.projectFingerprint === fingerprint)) continue;
    links.set(fingerprint, null);
    let remote: string;
    try {
      remote = execFileSync("git", ["-C", root, "remote", "get-url", "origin"], {
        stdio: ["ignore", "pipe", "ignore"], encoding: "utf8", timeout: 1000,
      }).trim();
    } catch { continue; }
    const candidate = githubRepositoryUrl(remote);
    if (!candidate) continue;
    // The cache stores hashes and confirmed public URLs, never a private remote or local path.
    const key = createHash("sha256").update(`${fingerprint}:${candidate}`).digest("hex");
    const previous = cache[key];
    const fresh = previous && Number.isFinite(previous.checkedAt) && previous.checkedAt <= Date.now() &&
      Date.now() - previous.checkedAt < (previous.url ? 86400000 : 3600000);
    let url = fresh && previous.url && publicUrl.test(previous.url) ? previous.url : null;
    if (!fresh && lookups < 8 && Date.now() - started < 5000) {
      lookups++;
      url = await verifyPublicRepository(candidate);
      cache[key] = { checkedAt: Date.now(), url };
    }
    links.set(fingerprint, url);
  }
  for (const event of events) {
    if (event.projectFingerprint && links.has(event.projectFingerprint)) {
      event.publicRepositoryUrl = links.get(event.projectFingerprint)!;
    }
  }
  try {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    const entries = Object.entries(cache).filter(([key, value]) => /^[a-f0-9]{64}$/.test(key) && value &&
      Number.isFinite(value.checkedAt) && (value.url === null || publicUrl.test(value.url)))
      .sort((a, b) => b[1].checkedAt - a[1].checkedAt).slice(0, 512);
    writeFileSync(`${path}.tmp`, JSON.stringify(Object.fromEntries(entries)), { mode: 0o600 });
    renameSync(`${path}.tmp`, path);
  } catch { /* Optional discovery must not interrupt usage uploads. */ }
}
