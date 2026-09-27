#!/usr/bin/env node
import { unlinkSync } from "node:fs";
import { hostname } from "node:os";
import { computeHeadlineTotal, type NormalizedUsageEvent } from "@token-maxxer/shared";
import { configExists, configPath, loadConfig, saveConfig } from "./config.js";
import { exchangePairingCode, ingestBatch } from "./api.js";
import { buildDiagnostics, connectors } from "./diagnostics.js";

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
  const code = String(flags.code ?? "");
  const name = String(flags.name ?? hostname());
  if (!server || !code) {
    console.error("Usage: token-maxxer-collector pair --server <url> --code <pairing-code> [--name <name>]");
    process.exitCode = 1;
    return;
  }

  const result = await exchangePairingCode(server, { pairingCode: code, collectorName: name });
  saveConfig({
    serverUrl: server,
    collectorId: result.collectorId,
    collectorName: name,
    token: result.token,
    projectSalt: result.projectSalt,
    pausedAt: null,
  });
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
  console.log(config.pausedAt ? `Collection is PAUSED (since ${config.pausedAt}).` : "Collection is active.");
}

async function collectAndUpload(): Promise<void> {
  const config = loadConfig();
  if (config.pausedAt) {
    console.log("Collection is paused. Run `token-maxxer-collector resume` to continue.");
    return;
  }

  let allEvents: NormalizedUsageEvent[] = [];
  for (const connector of connectors) {
    const status = await connector.detect();
    if (status.status !== "ok") continue;
    try {
      const events = await connector.collect(config.projectSalt);
      allEvents = allEvents.concat(events);
      console.log(`${connector.displayName}: collected ${events.length} usage record(s).`);
    } catch (err) {
      console.error(`${connector.displayName}: collection failed — ${(err as Error).message}`);
    }
  }

  if (allEvents.length === 0) {
    console.log("Nothing new to upload.");
    return;
  }

  const headlineTotal = allEvents.reduce((sum, e) => sum + computeHeadlineTotal(e.tokens), 0);
  console.log(`Uploading ${allEvents.length} record(s), ${headlineTotal.toLocaleString()} tokens (headline total)...`);

  // Batch to keep individual requests reasonably sized; the backend is idempotent per event so
  // batch boundaries don't matter for correctness.
  const BATCH_SIZE = 500;
  let accepted = 0;
  let duplicates = 0;
  for (let i = 0; i < allEvents.length; i += BATCH_SIZE) {
    const batch = allEvents.slice(i, i + BATCH_SIZE);
    const result = await ingestBatch(config.serverUrl, config.token, config.collectorName, batch);
    accepted += result.accepted;
    duplicates += result.duplicates;
  }
  console.log(`Done. Accepted ${accepted}, already-seen ${duplicates}.`);
}

async function cmdRun(flags: Record<string, string | boolean>) {
  if (!configExists()) {
    console.error("Not paired yet. Run `token-maxxer-collector pair --server <url> --code <code>` first.");
    process.exitCode = 1;
    return;
  }

  await collectAndUpload();

  if (flags.once) return;

  const intervalSeconds = Number(flags.interval ?? 300);
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

function cmdResume() {
  const config = loadConfig();
  config.pausedAt = null;
  saveConfig(config);
  console.log("Collection resumed.");
}

function cmdUnpair() {
  if (!configExists()) {
    console.log("Already unpaired locally.");
    return;
  }
  unlinkSync(configPath());
  console.log(
    "Local pairing removed. This machine will stop collecting. To fully revoke server-side " +
      "access for this collector, also remove it from your dashboard's collector list.",
  );
}

function printHelp() {
  console.log(`token-maxxer-collector — local usage collector for Token Maxxer

Commands:
  pair --server <url> --code <code> [--name <name>]   Pair this machine using a dashboard-issued code
  status                                                Show detected tools and pairing status
  run [--once] [--interval <seconds>]                   Collect + upload once, or on a loop (default 300s)
  pause                                                  Stop collecting without unpairing
  resume                                                 Resume collecting
  unpair                                                 Remove local pairing (revoke fully from the dashboard too)
`);
}

async function main() {
  const [, , command, ...rest] = process.argv;
  const flags = parseFlags(rest);

  switch (command) {
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
      cmdResume();
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
