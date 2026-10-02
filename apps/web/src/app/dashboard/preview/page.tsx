import { formatTokens } from "@/lib/formatTokens";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPrivateProfilePreview } from "@/lib/profile";
import { PublishToggle } from "@/components/PublishToggle";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";
import { DatabaseUnavailableNotice } from "@/components/DatabaseUnavailableNotice";
const labels: Record<string, string> = { claude_code: "Claude Code", codex: "Codex", opencode: "OpenCode" };
export default async function ProfilePreview() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  let profile, settings;
  try {
    [profile, settings] = await Promise.all([getPrivateProfilePreview(session.user.id), prisma.publishSettings.findUnique({ where: { userId: session.user.id } })]);
  } catch { return <DatabaseUnavailableNotice />; }
  if (!profile) return <Card>Your profile is still being set up. Return to your dashboard and try again.</Card>;
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-semibold tracking-tight">Profile preview</h1><p className="mt-2 text-sm text-foreground-muted">Only you can see this preview. Publishing shares your aggregate usage and the projects you have individually approved.</p></div>
    <Card><h2 className="text-xl font-semibold">{profile.name || profile.handle}</h2><p className="text-sm text-foreground-muted">@{profile.handle}</p><p className="mt-5 text-3xl font-semibold">{formatTokens(profile.totalTokens)} tokens</p><p className="mt-1 text-xs text-foreground-muted">All-time · locally reported usage · consumption, not productivity</p>
      {profile.hasUnknownCategories && <p className="mt-2 text-xs text-foreground-muted">Some token categories are not reported by your tools. Missing categories are excluded from the total.</p>}
    </Card>
    <div className="grid gap-4 sm:grid-cols-2"><Card><h2 className="mb-3 font-medium">Tools</h2>{profile.bySource.length ? profile.bySource.map(s => <p key={s.source} className="flex justify-between py-1 text-sm"><span>{labels[s.source] || s.source}</span><span>{formatTokens(s.tokens)}</span></p>) : <p className="text-sm text-foreground-muted">Connect your tools to see usage.</p>}</Card>
      <Card><h2 className="mb-3 font-medium">Models</h2>{profile.byModel.length ? profile.byModel.map(m => <p key={m.model} className="flex justify-between gap-2 py-1 text-sm"><span>{m.model}</span><span>{formatTokens(m.tokens)}</span></p>) : <p className="text-sm text-foreground-muted">No model usage received yet.</p>}</Card></div>
    <section><h2 className="mb-3 font-medium">Approved public projects</h2>{profile.projects.length ? profile.projects.map(p => <Card key={p.id} className="mb-3"><h3 className="font-medium">{p.linkUrl ? <a href={p.linkUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-accent underline">{p.displayName} ↗</a> : p.displayName}</h3>{p.description && <p className="mt-1 text-sm text-foreground-muted">{p.description}</p>}<p className="mt-2 text-sm">{formatTokens(p.tokens)} tokens</p></Card>) : <Card className="text-sm text-foreground-muted">No projects approved for public sharing. All detected project names stay private.</Card>}</section>
    <PublishToggle isPublic={settings?.isPublic ?? false} handle={profile.handle} />
    <Link href="/dashboard" className="inline-block text-sm text-accent underline">Manage projects and usage</Link>
  </div>;
}
