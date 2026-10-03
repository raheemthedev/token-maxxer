"use client";
import { useEffect, useState } from "react";
import { Badge } from "./ui/Badge";
import { RevokeCollectorButton } from "./RevokeCollectorButton";
import { collectorStatus } from "@/lib/collectorStatus";

type Collector = { clientVersion: string | null; id: string; name: string; status: string; kind: string; createdAt: string; lastSeenAt: string | null;
  lastIngestSummary: string | null; connectorStatuses: { source: string; displayName: string; status: string; message: string }[] | null };
const currentTracking = (c: Collector, now: number) => c.kind === "cli" && c.clientVersion === "0.3.0" && collectorStatus(c, now).tone === "green";
const quote = (s: string) => "'" + s.replaceAll("'", "'\\''") + "'";
export function CollectorOnboarding({ serverUrl, initialCollectors, initialNow }: { serverUrl: string; initialCollectors: Collector[]; initialNow: number }) {
  const [now, setNow] = useState(initialNow);
  const [collectors, setCollectors] = useState(initialCollectors);
  const [platform, setPlatform] = useState("unix");
  const [setupRequested, setSetupRequested] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasCurrent = collectors.some(c => currentTracking(c, now));
  const showSetup = !hasCurrent || setupRequested;
  const needsUpdate = !hasCurrent && collectors.some(c => c.status === "active" && c.kind === "cli");
  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/collector/status", { cache: "no-store", signal: controller.signal });
        if (!res.ok) return;
        const updated: Collector[] = (await res.json()).collectors;
        setCollectors(updated);
        if (code && updated.some(c => currentTracking(c, Date.now()) &&
          (!initialCollectors.some(old => old.id === c.id) || !initialCollectors.some(old => currentTracking(old, initialNow))))) setSetupRequested(false);
        setNow(Date.now());
      } catch { /* reconnect on next poll */ }
    };
    const interval = setInterval(refresh, 5000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [code, initialCollectors, initialNow]);
  async function generate() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/collector/pair-code", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not generate an install command.");
      setCode(data.code); setExpiresAt(data.expiresAt);
    } catch (e) { setError(e instanceof Error ? e.message : "Connection failed. Try again."); }
    finally { setLoading(false); }
  }
  const expired = expiresAt ? now >= +new Date(expiresAt) : false;
  const command = platform === "windows"
    ? `$s = (Invoke-WebRequest '${serverUrl}/install.ps1').Content; & ([scriptblock]::Create($s)) -Server '${serverUrl}' -Code '${code}'`
    : `curl -fsSL ${quote(`${serverUrl}/install.sh`)} | sh -s -- --server ${quote(serverUrl)} --code ${code}`;
  async function copy() {
    try { await navigator.clipboard.writeText(command); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setError("Clipboard is unavailable. Select and copy the command above."); }
  }
  const steps = [
    ["1", "Generate", "Create your private, one-use install command."],
    ["2", "Paste", <>Run it in a terminal on your coding machine. Needs <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className="text-accent underline">Node.js 20+</a>.</>],
    ["3", "Done", "Watch “Receiving uploads” appear below, then review and publish when ready."],
  ] as const;
  return <div className="space-y-6">
    {!showSetup && <div className="card flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="font-medium">Your tools are connected</h2><p className="mt-1 text-sm text-foreground-muted">Usage syncs automatically. You can close this page.</p></div><button className="pill pill-light" onClick={() => setSetupRequested(true)}>Connect another machine</button></div>}
    {showSetup && <div className="card p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-3"><span className="eyebrow">Recommended</span><Badge tone="accent">Claude Code · Codex · OpenCode</Badge></div>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight">{needsUpdate ? "Update your tracking" : "Connect your coding machine"}</h2>
      {needsUpdate && <p className="mt-2 text-sm text-foreground-muted">Run the updated command once to separate folder projects from chats. Your account and usage are preserved.</p>}
      <p className="mt-2 max-w-2xl text-sm text-foreground-muted">One collector finds your tools, imports available history, and tracks new usage every five minutes. It starts automatically after login — no repository to clone, no terminal to keep open.</p>
      <ol className="mt-6 grid gap-3 sm:grid-cols-3">
        {steps.map(([n, title, body]) => <li key={n} className="rounded-3xl bg-surface-muted/60 p-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">{n}</span>
          <div className="mt-3 font-medium">{title}</div><div className="mt-1 text-sm text-foreground-muted">{body}</div>
        </li>)}
      </ol>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="segmented" role="group" aria-label="Operating system">
          {[['unix', 'macOS / Linux'], ['windows', 'Windows PowerShell']].map(([value, label]) => <button key={value} onClick={() => setPlatform(value)} aria-pressed={platform === value} aria-current={platform === value ? "true" : undefined}>{label}</button>)}
        </div>
        {!(code && !expired) && <button disabled={loading} onClick={generate} className="pill pill-dark disabled:opacity-50">{loading ? "Generating…" : expired ? "Generate a fresh command" : "Generate install command"}</button>}
      </div>
      {code && !expired && <div className="mt-4 overflow-hidden rounded-3xl bg-ink text-white shadow-[0_18px_40px_-24px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden><i className="h-2.5 w-2.5 rounded-full bg-white/20" /><i className="h-2.5 w-2.5 rounded-full bg-white/20" /><i className="h-2.5 w-2.5 rounded-full bg-white/20" /></span>
          <span className="eyebrow !text-white/50">One use · expires {new Date(expiresAt!).toLocaleTimeString()}</span>
        </div>
        <pre className="select-all overflow-x-auto p-4 font-mono text-xs leading-relaxed text-white/90">{command}</pre>
        <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-4 py-3">
          <button onClick={copy} className="pill bg-white !py-2 text-ink hover:opacity-90">{copied ? "✓ Copied" : "Copy install command"}</button>
          <span className="text-xs text-white/50">Keep it private — it pairs this account.</span>
        </div>
      </div>}
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      <p className="mt-5 text-xs text-foreground-muted">Only token counts, model names, timestamps and folder project names are uploaded. Prompts, code and full paths stay on your machine. Your profile starts unpublished. Publishing shows folder names; private project links stay hidden.</p>
    </div>}
    <section><h2 className="eyebrow mb-3">Connection status</h2>
      {collectors.length ? <div className="space-y-3">{collectors.map(c => {
        const status = collectorStatus(c, now);
        return <div key={c.id} className="card flex flex-col items-start justify-between gap-4 p-5 sm:flex-row">
          <div className="min-w-0"><p className="flex flex-wrap items-center gap-2 font-medium">{c.name}<Badge tone={status.tone} dot live={status.tone === "green"}>{status.label}</Badge></p>
            <p className="mt-1 text-sm text-foreground-muted">{status.description}</p>
            {c.lastSeenAt && <p className="eyebrow mt-2">Last upload · <time dateTime={c.lastSeenAt}>{new Date(c.lastSeenAt).toISOString().slice(0, 19).replace("T", " ")} UTC</time></p>}
            {!!c.connectorStatuses?.length && <ul className="mt-3 flex flex-wrap gap-2">{c.connectorStatuses.map(s => <li key={s.source} title={s.message} className="rounded-full bg-surface-muted/70 px-3 py-1 text-xs"><span className="font-medium">{s.displayName}</span> <span className="text-foreground-muted">· {s.message}</span></li>)}</ul>}
            {c.lastIngestSummary && <p className="mt-2 text-xs text-foreground-muted">{c.lastIngestSummary}</p>}
          </div><RevokeCollectorButton id={c.id} active={c.status === "active"} />
        </div>;
      })}</div> : <div className="card p-6 text-sm text-foreground-muted">Your machine will appear here after you run the install command. This page updates automatically.</div>}
    </section>
  </div>;
}
