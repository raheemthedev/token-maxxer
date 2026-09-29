import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PairingCodeGenerator } from "@/components/PairingCodeGenerator";
import { OtelSetupGenerator } from "@/components/OtelSetupGenerator";
import { RevokeCollectorButton } from "@/components/RevokeCollectorButton";
import { DatabaseUnavailableNotice } from "@/components/DatabaseUnavailableNotice";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function CollectorPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  let collectors: Awaited<ReturnType<typeof prisma.collector.findMany>>;
  try {
    collectors = await prisma.collector.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return <DatabaseUnavailableNotice />;
  }

  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const host = hdrs.get("host") ?? "localhost:3000";
  const serverUrl = `${proto}://${host}`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Collector</h1>
        <p className="mt-1 text-foreground-muted">
          One local collector detects supported tools (Claude Code, OpenCode) and uploads usage
          metadata only — never prompts, code, or full file paths.
        </p>
      </div>

      <OtelSetupGenerator />

      <details>
        <summary className="cursor-pointer text-sm font-medium text-foreground-muted">
          Advanced: manual collector (required for OpenCode, or for more precise project detection)
        </summary>
        <div className="mt-3">
          <PairingCodeGenerator serverUrl={serverUrl} />
        </div>
      </details>

      <section>
        <h2 className="mb-3 font-medium">Paired collectors</h2>
        {collectors.length === 0 ? (
          <Card className="text-sm text-foreground-muted">None yet.</Card>
        ) : (
          <Card className="divide-y divide-border-soft p-0">
            {collectors.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {c.name}
                    <Badge tone={c.status === "active" ? "green" : "neutral"}>{c.status}</Badge>
                  </p>
                  <p className="mt-0.5 text-xs text-foreground-muted">
                    Paired {c.createdAt.toLocaleDateString()}
                    {c.lastSeenAt && ` · last seen ${new Date(c.lastSeenAt).toLocaleString()}`}
                  </p>
                </div>
                {c.status === "active" && <RevokeCollectorButton id={c.id} />}
              </div>
            ))}
          </Card>
        )}
      </section>

      <Card className="bg-surface-muted !shadow-none">
        <h2 className="mb-2 font-medium">Collector commands</h2>
        <pre className="overflow-x-auto rounded-xl bg-surface p-3.5 font-mono text-sm">
{`token-maxxer-collector status          # see detected tools
token-maxxer-collector run --once      # collect + upload once
token-maxxer-collector run             # keep collecting every 5 minutes
token-maxxer-collector pause / resume  # pause without unpairing
token-maxxer-collector unpair          # remove local pairing`}
        </pre>
        <p className="mt-3 text-sm text-foreground-muted">
          Diagnostics reported by the collector never include prompt/response content or full
          local paths.
        </p>
      </Card>
    </div>
  );
}
