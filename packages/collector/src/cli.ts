#!/usr/bin/env node
import { unlinkSync, rmSync } from "node:fs";
import { join } from "node:path";
import { hostname } from "node:os";
import { collectAndUpload } from "./sync.js";
import { backgroundInstalled, installBackground, uninstallBackground, localSyncStatus } from "./background.js";
import { CONFIG_DIR, configExists, configPath, loadConfig, saveConfig } from "./config.js";
import { exchangePairingCode } from "./api.js";
import { buildDiagnostics } from "./diagnostics.js";

function parseFlags(argv: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return flags;
}

async function cmdPair(flags: Record<string, string | boolean>) {
  const server = String(flags.server ?? "");
  const previous = configExists() ? loadConfig() : null;
  const code = String(flags.code ?? "");
  const name = String(flags.name ?? hostname());
  if (!server || !code) {
    console.error("Usage: token-maxxer-collector pair --server <url> --code <pairing-code> [--name <name>]");
    process.exitCode = 1;
    return;
  }

  if (previous && new URL(previous.serverUrl).origin !== new URL(server).origin && !flags.replace) throw new Error("This machine is paired to another server. Use --replace to switch deliberately.");
  if (server && !/^https:\/\//.test(server) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(server)) throw new Error("Use an HTTPS server URL (HTTP is allowed only for localhost).");

  const result = await exchangePairingCode(server, { pairingCode: code, collectorName: name, replace: Boolean(flags.replace) }, previous && new URL(previous.serverUrl).origin === new URL(server).origin ? previous.token : undefined);
  saveConfig({
    serverUrl: server,
    collectorId: result.collectorId,
    collectorName: name,
    token: result.token,
    projectSalt: result.projectSalt,
    pausedAt: null,
    sources: typeof flags.sources === "string" ? flags.sources.split(",") : undefined,
  });
  for (const name of ["pending.json", "acknowledged.json", "sync-status.json"]) rmSync(join(CONFIG_DIR, name), { force: true });
  console.log(`Paired as collector "${name}" for @${result.userHandle}.`);
  console.log(`Config saved to ${configPath()} (permissions 600).`);
  console.log(`Run \`token-maxxer-collector status\` to see detected tools, then \`run\` to start collecting.`);
}

async function cmdStatus() {
  const diagnostics = await buildDiagnostics();
  console.log(`Diagnostics as of ${diagnostics.generatedAt}\n`);
  for (const c of diagnostics.connectors) {
    console.log(`  [${c.status.toUpperCase().padEnd(11)}] ${c.displayName}: ${c.message}`);
    for (const step of c.setupSteps ?? []) console.log(`      - ${step}`);
  }
  console.log();
  if (!configExists()) {
    console.log("Not paired yet. Run `token-maxxer-collector pair --server <url> --code <code>`.");
    return;
  }
  const config = loadConfig();
  console.log(`Paired: collector "${config.collectorName}" -> ${config.serverUrl}`);
  console.log(`Sharing status is controlled in your dashboard, not the collector.`);
  console.log(`Background tracking: ${backgroundInstalled() ? "installed (every 5 minutes)" : "not installed — run setup"}.`);
  console.log("Last sync:", JSON.stringify(localSyncStatus(), null, 2));
  console.log(config.pausedAt ? `Collection is PAUSED (since ${config.pausedAt}).` : "Collection is active.");
}

async function cmdRun(flags: Record<string, string | boolean>) {
  if (!configExists()) {
    console.error("Not paired yet. Run `token-maxxer-collector pair --server <url> --code <code>` first.");
    process.exitCode = 1;
    return;
  }

  const intervalSeconds = Number(flags.interval ?? 300);
  if (!Number.isFinite(intervalSeconds) || intervalSeconds < 30) throw new Error("Interval must be at least 30 seconds.");
  try { await collectAndUpload(); } catch (err) {
    if (flags.once) throw err;
    console.error("Upload failed. Queued records will be retried automatically.");
  }
  if (flags.once) return;

  console.log(`Watching for new usage every ${intervalSeconds}s. Ctrl+C to stop.`);
  setInterval(() => {
    collectAndUpload().catch((err) => console.error("Collection cycle failed:", (err as Error).message));
  }, intervalSeconds * 1000);
}

function cmdPause() {
  const config = loadConfig();
  config.pausedAt = new Date().toISOString();
  saveConfig(config);
  console.log("Collection paused.");
}

async function cmdResume() {
  const config = loadConfig();
  config.pausedAt = null;
  saveConfig(config);
  console.log("Collection resumed.");
  await collectAndUpload();
}

function cmdUnpair() {
  uninstallBackground();
  if (!configExists()) {
    console.log("Already unpaired locally.");
    return;
  }
  unlinkSync(configPath());
  for (const name of ["pending.json", "acknowledged.json", "sync-status.json"]) rmSync(join(CONFIG_DIR, name), { force: true });
  console.log(
    "Local pairing removed. This machine will stop collecting. To fully revoke server-side " +
      "access for this collector, also remove it from your dashboard's collector list.",
  );
}

function printHelp() {
  console.log(`token-maxxer-collector — local usage collector for Token Maxxer

Commands:
  setup --server <url> --code <code>                  Pair and enable automatic background tracking
  pair --server <url> --code <code> [--name <name>]   Pair this machine using a dashboard-issued code
  status                                                Show detected tools and pairing status
  run [--once] [--interval <seconds>]                   Collect + upload once, or on a loop (default 300s)
  pause                                                  Stop collecting without unpairing
  resume                                                 Resume collecting
  stop                                                   Remove automatic background startup
  unpair                                                 Remove local pairing (revoke fully from the dashboard too)
`);
}

async function main() {
  const [, , command, ...rest] = process.argv;
  const flags = parseFlags(rest);

  switch (command) {
    case "setup":
      if (flags.code) await cmdPair(flags);
      if (!configExists()) throw new Error("Generate an install command from your Collector page first.");
      installBackground();
      console.log("Background tracking installed. It runs every 5 minutes and resumes after login.");
      try { await collectAndUpload(); } catch { console.log("First upload is pending. It will retry automatically; run status to see progress."); }
      break;
    case "stop":
      uninstallBackground();
      console.log("Background tracking stopped. Your account and usage are preserved.");
      break;
    case "pair":
      await cmdPair(flags);
      break;
    case "status":
      await cmdStatus();
      break;
    case "run":
      await cmdRun(flags);
      break;
    case "pause":
      cmdPause();
      break;
    case "resume":
      await cmdResume();
      break;
    case "unpair":
      cmdUnpair();
      break;
    default:
      printHelp();
      process.exitCode = command ? 1 : 0;
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exitCode = 1;
});
