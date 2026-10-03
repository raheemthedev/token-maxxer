import { execFile, spawn } from "node:child_process";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { promisify } from "node:util";
import type { NormalizedUsageEvent } from "@token-maxxer/shared";
import { detectProject } from "../project.js";
import type { Connector, ConnectorStatus } from "./types.js";

const exec = promisify(execFile);
const options = { encoding: "utf8" as const, timeout: 30000, maxBuffer: 128 * 1024 * 1024 };
async function withLocalApi<T>(read: (get: (path: string) => Promise<unknown>) => Promise<T>): Promise<T> {
  const port = await new Promise<number>((resolve, reject) => { const socket = createServer(); socket.on("error", reject);
    socket.listen(0, "127.0.0.1", () => { const port = (socket.address() as { port: number }).port; socket.close(() => resolve(port)); }); });
  const password = randomBytes(24).toString("hex");
  const child = spawn("opencode", ["--pure", "serve", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: homedir(), stdio: "ignore", env: { ...process.env, OPENCODE_SERVER_USERNAME: "opencode", OPENCODE_SERVER_PASSWORD: password, OPENCODE_DISABLE_AUTOUPDATE: "true" },
  });
  let failed = false; child.on("error", () => { failed = true; });
  const get = async (path: string) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers: { authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}` }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error("Local OpenCode API is unavailable.");
    return res.json() as Promise<unknown>;
  };
  try {
    const deadline = Date.now() + 20000;
    let ready = false;
    while (Date.now() < deadline && !failed && child.exitCode === null) {
      try { const health = await get("/global/health") as { healthy?: boolean }; if (health.healthy) { ready = true; break; } } catch { /* wait for startup */ }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (!ready) throw new Error("OpenCode's local usage API did not start. Update OpenCode and try again.");
    return await read(get);
  } finally {
    child.kill("SIGTERM");
  }
}

export const opencodeConnector: Connector = {
  source: "opencode", displayName: "OpenCode",
  async detect(): Promise<ConnectorStatus> {
    try {
      const { stdout, stderr } = await exec("opencode", ["--help"], options);
      const help = stdout + stderr;
      if (!help.includes("--pure") || !help.includes("serve")) return { source: "opencode", displayName: "OpenCode", detected: true,
        status: "needs_setup", message: "Update OpenCode to a version supporting the isolated local server API." };
      return { source: "opencode", displayName: "OpenCode", detected: true, status: "ok", message: "OpenCode found. Usage is read through its local API." };
    } catch {
      return { source: "opencode", displayName: "OpenCode", detected: false, status: "unsupported",
        message: "OpenCode is not available on PATH, or its session export interface is unavailable." };
    }
  },
  async collect(projectSalt) {
    return withLocalApi(async get => {
      // The project-scoped endpoint misses other repositories and defaults to 100 sessions.
      // Increase the global limit until complete; timestamp cursors can skip ties at a boundary.
      let limit = 500;
      let sessions: unknown;
      while (true) {
        sessions = await get(`/experimental/session?roots=false&archived=true&limit=${limit}`);
        if (!Array.isArray(sessions)) throw new Error("Unsupported OpenCode session format.");
        if (sessions.length < limit) break;
        limit *= 2;
        if (limit > 1000000) throw new Error("OpenCode history exceeds the supported import size.");
      }
      if (!Array.isArray(sessions)) throw new Error("Unsupported OpenCode session format.");
      const events: NormalizedUsageEvent[] = [];
      const seen = new Set<string>();
      for (const session of sessions) {
        if (!session || typeof session.id !== "string" || !session.id.startsWith("ses") || seen.has(session.id)) continue;
        seen.add(session.id);
        const messages = await get(`/session/${encodeURIComponent(session.id)}/message`);
        events.push(...parseOpenCodeExport({ info: { id: session.id }, messages }, projectSalt, typeof session.directory === "string" ? session.directory : undefined));
      }
      return events;
    });
  },
};

/** Only assistant numeric metadata is retained. Message parts and session titles are discarded
 * locally. This accepts the same metadata shape returned by the public API and session export. */
export function parseOpenCodeExport(payload: unknown, salt: string, directory?: string): NormalizedUsageEvent[] {
  if (!payload || typeof payload !== "object") throw new Error("Unsupported OpenCode export.");
  const data = payload as { info?: { id?: string }; messages?: { info?: { id?: string; role?: string; modelID?: string; providerID?: string;
    time?: { created?: number; completed?: number }; tokens?: { input?: number; output?: number; reasoning?: number; cache?: { read?: number; write?: number } } } }[] };
  if (!data.info?.id || !Array.isArray(data.messages)) throw new Error("Unsupported OpenCode export.");
  const project = directory ? detectProject(directory, salt) : null;
  const events: NormalizedUsageEvent[] = [];
  for (const message of data.messages) {
    const msg = message?.info;
    if (msg?.role !== "assistant" || !msg.id || !msg.tokens || !msg.time?.completed) continue;
    const t = msg.tokens;
    const values = [t.input, t.output, t.reasoning, t.cache?.read, t.cache?.write];
    if (values.some(v => v !== undefined && (!Number.isSafeInteger(v) || v < 0))) continue;
    const time = new Date(msg.time.completed);
    if (!Number.isFinite(time.getTime())) continue;
    events.push({ source: "opencode", sourceVersion: null, connectorVersion: "0.2.0", provider: msg.providerID ?? null,
      model: msg.modelID ?? null, sourceEventId: `opencode:${data.info.id}:${msg.id}`, eventType: "incremental",
      observedAt: time.toISOString(), periodStart: null, periodEnd: null,
      tokens: { input: t.input ?? null, output: t.output ?? null, cacheRead: t.cache?.read ?? null,
        cacheWrite: t.cache?.write ?? null, reasoning: t.reasoning ?? null, reasoningIncludedInOutput: false },
      projectFingerprint: project?.folderConfirmed ? project.fingerprintHash : null, projectDetectionMethod: project?.folderConfirmed ? project.detectionMethod : null,
      localProjectHint: project?.folderConfirmed ? project.localHint : null, projectFolderConfirmed: project?.folderConfirmed ?? false, evidenceLevel: "locally_reported" });
  }
  return events;
}
