import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { CONFIG_DIR } from "./config.js";

const label = process.env.TOKEN_MAXXER_SERVICE_LABEL || "io.tokenmaxxer.collector";
if (!/^[a-zA-Z0-9.-]+$/.test(label)) throw new Error("Invalid collector service label.");
const inherited = ["CODEX_HOME", "CLAUDE_CONFIG_DIR", "XDG_DATA_HOME", "XDG_CONFIG_HOME", "XDG_STATE_HOME", "XDG_CACHE_HOME", "TOKEN_MAXXER_SERVICE_LABEL"];
const envEntries = () => inherited.filter(k => process.env[k]).map(k => [k, process.env[k]!] as const);
export const installedCollector = () => join(CONFIG_DIR, "collector.cjs");
const xml = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const shell = (s: string) => "'" + s.replaceAll("'", "'\\''") + "'";
export function serviceDefinition(platform: string, executable: string, collector: string, home = homedir()) {
  const args = [executable, collector, "run", "--once"];
  if (platform === "darwin") return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>
<key>Label</key><string>${label}</string><key>ProgramArguments</key><array>${args.map(a => `<string>${xml(a)}</string>`).join("")}</array>
<key>RunAtLoad</key><true/><key>StartInterval</key><integer>300</integer>
<key>EnvironmentVariables</key><dict><key>TOKEN_MAXXER_HOME</key><string>${xml(CONFIG_DIR)}</string><key>PATH</key><string>${xml(process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin")}</string>${envEntries().map(([k, v]) => `<key>${xml(k)}</key><string>${xml(v)}</string>`).join("")}</dict>
<key>StandardOutPath</key><string>${xml(join(CONFIG_DIR, "collector.log"))}</string>
<key>StandardErrorPath</key><string>${xml(join(CONFIG_DIR, "collector.log"))}</string>
</dict></plist>\n`;
  if (platform === "linux") return `# ${label}\n*/5 * * * * TOKEN_MAXXER_HOME=${shell(CONFIG_DIR)} PATH=${shell(process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin")} ${envEntries().map(([k,v]) => `${k}=${shell(v)}`).join(" ")} ${args.map(shell).join(" ")} >> ${shell(join(CONFIG_DIR, "collector.log"))} 2>&1 # ${label}\n`;
  if (platform === "win32") return args.map(a => `"${a}"`).join(" ");
  throw new Error("Automatic startup currently supports macOS, Linux and Windows.");
}
export function installBackground(sourceFile = process.argv[1]) {
  if (!sourceFile.endsWith(".cjs")) throw new Error("Build the collector first: npm run collector:build, then use node packages/collector/dist/collector.cjs setup.");
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  const target = installedCollector();
  if (sourceFile !== target) copyFileSync(sourceFile, target);
  if (process.platform === "darwin") {
    const dir = join(homedir(), "Library", "LaunchAgents"); mkdirSync(dir, { recursive: true });
    const path = join(dir, `${label}.plist`);
    try { execFileSync("launchctl", ["bootout", `gui/${process.getuid!()}`, path], { stdio: "ignore" }); } catch { /* no previous job */ }
    writeFileSync(path, serviceDefinition("darwin", process.execPath, target), { mode: 0o600 });
    execFileSync("launchctl", ["bootstrap", `gui/${process.getuid!()}`, path], { stdio: "ignore" });
  } else if (process.platform === "linux") {
    let previous = "";
    try { previous = execFileSync("crontab", ["-l"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { /* no crontab */ }
    const lines = previous.split("\n").filter(l => !l.includes(label)).join("\n").trim();
    execFileSync("crontab", ["-"], { input: `${lines}\n${serviceDefinition("linux", process.execPath, target)}`, stdio: ["pipe", "ignore", "pipe"] });
  } else if (process.platform === "win32") {
    execFileSync("schtasks", ["/Create", "/TN", "TokenMaxxerCollector", "/SC", "MINUTE", "/MO", "5", "/TR", serviceDefinition("win32", process.execPath, target), "/F"], { stdio: "ignore" });
  } else throw new Error("Unsupported operating system for background startup.");
  writeFileSync(join(CONFIG_DIR, "background.json"), JSON.stringify({ platform: process.platform, installedAt: new Date().toISOString() }), { mode: 0o600 });
}
export function backgroundInstalled(): boolean {
  return existsSync(join(CONFIG_DIR, "background.json"));
}
export function uninstallBackground() {
  if (!backgroundInstalled()) return;
  if (process.platform === "darwin") {
    const path = join(homedir(), "Library", "LaunchAgents", `${label}.plist`);
    try { execFileSync("launchctl", ["bootout", `gui/${process.getuid!()}`, path], { stdio: "ignore" }); } catch { /* job already stopped */ }
    if (existsSync(path)) unlinkSync(path);
  } else if (process.platform === "linux") {
    const previous = execFileSync("crontab", ["-l"], { encoding: "utf8" });
    execFileSync("crontab", ["-"], { input: previous.split("\n").filter(l => !l.includes(label)).join("\n") });
  } else if (process.platform === "win32") execFileSync("schtasks", ["/Delete", "/TN", "TokenMaxxerCollector", "/F"], { stdio: "ignore" });
  unlinkSync(join(CONFIG_DIR, "background.json"));
}
export function localSyncStatus(): unknown {
  try { return JSON.parse(readFileSync(join(CONFIG_DIR, "sync-status.json"), "utf8")); } catch { return { message: "No upload completed yet." }; }
}
