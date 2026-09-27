import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PairingCodeGenerator } from "@/components/PairingCodeGenerator";
import { RevokeCollectorButton } from "@/components/RevokeCollectorButton";

export default async function CollectorPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const collectors = await prisma.collector.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const host = hdrs.get("host") ?? "localhost:3000";
  const serverUrl = `${proto}://${host}`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Collector</h1>
        <p className="text-neutral-500">
          One local collector detects supported tools (Claude Code, OpenCode) and uploads usage
          metadata only — never prompts, code, or full file paths.
        </p>
      </div>

      <PairingCodeGenerator serverUrl={serverUrl} />

      <section>
        <h2 className="mb-3 font-medium">Paired collectors</h2>
        {collectors.length === 0 ? (
          <p className="text-sm text-neutral-500">None yet.</p>
        ) : (
          <ul className="space-y-2">
            {collectors.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800"
              >
                <div>
                  <p>
                    {c.name}{" "}
                    <span
                      className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
                        c.status === "active"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                          : "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                      }`}
                    >
                      {c.status}
                    </span>
                  </p>
                  <p className="text-xs text-neutral-400">
                    Paired {c.createdAt.toLocaleDateString()}
                    {c.lastSeenAt && ` · last seen ${new Date(c.lastSeenAt).toLocaleString()}`}
                  </p>
                </div>
                {c.status === "active" && <RevokeCollectorButton id={c.id} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-md border border-neutral-200 p-4 text-sm dark:border-neutral-800">
        <h2 className="mb-2 font-medium">Collector commands</h2>
        <pre className="overflow-x-auto rounded-md bg-neutral-100 p-3 dark:bg-neutral-900">
{`token-maxxer-collector status          # see detected tools
token-maxxer-collector run --once      # collect + upload once
token-maxxer-collector run             # keep collecting every 5 minutes
token-maxxer-collector pause / resume  # pause without unpairing
token-maxxer-collector unpair          # remove local pairing`}
        </pre>
        <p className="mt-2 text-neutral-500">
          Diagnostics reported by the collector never include prompt/response content or full
          local paths.
        </p>
      </section>
    </div>
  );
}
