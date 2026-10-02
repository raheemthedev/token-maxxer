"use client";
import { useState } from "react";
import { Card } from "./ui/Card";
export function OtelSetupGenerator() {
  const [command, setCommand] = useState<string | null>(null);
  const [loading, setLoading] = useState(false), [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function generate() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/collector/otel-setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not generate telemetry setup.");
      const env = { CLAUDE_CODE_ENABLE_TELEMETRY: "1", OTEL_METRICS_EXPORTER: "otlp",
        OTEL_LOGS_EXPORTER: "none", OTEL_TRACES_EXPORTER: "none", OTEL_EXPORTER_OTLP_METRICS_PROTOCOL: "http/json",
        OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: data.metricsEndpoint, OTEL_EXPORTER_OTLP_METRICS_HEADERS: `Authorization=Bearer ${data.token}`,
        OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE: "delta", OTEL_METRIC_EXPORT_INTERVAL: "60000", OTEL_METRICS_INCLUDE_REPOSITORY: "true" };
      const script = `const fs=require("node:fs"),p=require("node:path"),os=require("node:os");const dir=p.join(os.homedir(),".claude"),file=p.join(dir,"settings.json");fs.mkdirSync(dir,{recursive:true});let settings={};if(fs.existsSync(file)){settings=JSON.parse(fs.readFileSync(file,"utf8"));fs.copyFileSync(file,file+".token-maxxer-backup-"+Date.now());}settings.env={...settings.env,...${JSON.stringify(env)}};fs.writeFileSync(file,JSON.stringify(settings,null,2)+"\\n",{mode:384});console.log("Token Maxxer configured. Start a new Claude Code session to begin tracking.");`;
      setCommand(`node -e '${script.replaceAll("'", "'\\''")}'`);
    } catch (e) { setError(e instanceof Error ? e.message : "Connection failed. Try again."); }
    finally { setLoading(false); }
  }
  async function copy() { try { await navigator.clipboard.writeText(command!); setCopied(true); } catch { setError("Select and copy the command above."); } }
  return <Card><h2 className="font-medium">Claude Code telemetry</h2>
    <p className="my-3 text-sm text-foreground-muted">For Claude Code only. Run the command below in a macOS or Linux terminal to add usage-only telemetry to your Claude settings, then start a new session. Existing settings are preserved and backed up. This tracks new usage without importing history.</p>
    <p className="mb-4 text-xs text-foreground-muted">Use one collection method for Claude Code. The recommended local collector also handles Codex and OpenCode.</p>
    {command ? <div><pre className="overflow-x-auto rounded-2xl bg-ink p-4 font-mono text-xs text-white/90">{command}</pre><button onClick={copy} className="pill pill-light mt-3">{copied ? "Copied" : "Copy command"}</button><p className="mt-2 text-xs text-foreground-muted">This contains a private token. Keep it on your own machine.</p></div>
      : <button onClick={generate} disabled={loading} className="pill pill-light disabled:opacity-50">{loading ? "Generating…" : "Generate telemetry setup"}</button>}
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
  </Card>;
}
