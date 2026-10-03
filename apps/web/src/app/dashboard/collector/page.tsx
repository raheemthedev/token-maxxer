import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CollectorOnboarding } from "@/components/CollectorOnboarding";
import { OtelSetupGenerator } from "@/components/OtelSetupGenerator";
import { DatabaseUnavailableNotice } from "@/components/DatabaseUnavailableNotice";
import { Card } from "@/components/ui/Card";

export default async function CollectorPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  let collectors;
  try {
    collectors = await prisma.collector.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" },
      select: { id: true, name: true, kind: true, clientVersion: true, status: true, createdAt: true, lastSeenAt: true, lastIngestSummary: true, connectorStatuses: true } });
  } catch { return <DatabaseUnavailableNotice />; }
  const hdrs = await headers();
  const serverUrl = process.env.AUTH_URL || `${hdrs.get("x-forwarded-proto") ?? "http"}://${hdrs.get("host") ?? "localhost:3000"}`;
  return <div className="space-y-8">
    <div><span className="eyebrow">Setup</span><h1 className="mt-1 text-3xl font-semibold tracking-tight">Connect your tools</h1><p className="mt-1 text-foreground-muted">Set up once. Keep building. Your usage updates in the background.</p></div>
    <CollectorOnboarding serverUrl={serverUrl} initialNow={+new Date()} initialCollectors={JSON.parse(JSON.stringify(collectors))} />
    <details><summary className="cursor-pointer text-sm font-medium text-foreground-muted">Alternative: Claude Code telemetry only</summary><div className="mt-3"><OtelSetupGenerator /></div></details>
    <Card className="bg-surface-muted/60 !shadow-none"><h2 className="eyebrow mb-3">Manage tracking from your terminal</h2>
      <p className="mb-3 text-sm text-foreground-muted">Use the installed collector to check status or pause uploads. On Windows, replace <code>~</code> with your user folder.</p>
      <pre className="overflow-x-auto rounded-2xl bg-ink p-4 font-mono text-xs leading-relaxed text-white/90">{`node ~/.token-maxxer/collector.cjs status\nnode ~/.token-maxxer/collector.cjs pause\nnode ~/.token-maxxer/collector.cjs resume\nnode ~/.token-maxxer/collector.cjs stop\nnode ~/.token-maxxer/collector.cjs unpair`}</pre>
      <p className="mt-3 text-xs text-foreground-muted">Stop removes automatic startup. Unpair also removes this machine&apos;s pairing. Revoke a collector here to block uploads immediately.</p>
    </Card>
  </div>;
}
