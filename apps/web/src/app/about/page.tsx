import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-foreground-muted [&_code]:rounded [&_code]:bg-surface-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-foreground [&_strong]:font-medium [&_strong]:text-foreground">
        {children}
      </div>
    </Card>
  );
}

export const metadata: Metadata = { title: "How counting works" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">How counting works</h1>

      <div className="space-y-6">
        <Section title="Headline total">
          <p>
            <code>total = input + output + cache-read + cache-write + reasoning</code> (reasoning
            is only added separately when a source reports it as a distinct field instead of
            folding it into output — see the full rules in <code>docs/ACCOUNTING.md</code> in the
            repository).
          </p>
          <p>
            This is a <strong>token consumption</strong> leaderboard, not a productivity ranking.
            Different models use very different numbers of tokens to do similar work. We don&apos;t
            normalize across models, tools, or task difficulty, and raw token counts should not be
            read as a measure of skill or output quality.
          </p>
        </Section>

        <Card className="bg-accent-soft/40">
          <h2 className="mb-3 text-lg font-semibold">A worked example</h2>
          <div className="grid gap-x-8 gap-y-1 font-mono text-sm sm:grid-cols-2">
            <span>fresh input</span><span className="text-right">1,000</span>
            <span>output</span><span className="text-right">500</span>
            <span>cache read</span><span className="text-right">40,000</span>
            <span>cache write</span><span className="text-right">2,000</span>
            <span className="border-t border-border-soft pt-1 font-semibold">headline total</span>
            <span className="border-t border-border-soft pt-1 text-right font-semibold">43,500</span>
          </div>
          <p className="mt-3 text-sm text-foreground-muted">
            Cache reads dominate agentic coding because the same context is re-sent on every step — so totals
            reach hundreds of millions. That is consumption, not quality.
          </p>
        </Card>

        <Section title="Periods">
          <p>
            All boundaries are computed in UTC. &ldquo;This week&rdquo; starts Monday 00:00 UTC.
            &ldquo;Today&rdquo; is the current UTC calendar day.
          </p>
        </Section>

        <Section title="Evidence labels">
          <p>
            <strong>Locally reported</strong> — received from a builder&apos;s own paired
            collector or local records. This is the only evidence level this release can produce.
          </p>
          <p>
            <strong>Provider verified</strong> — would mean confirmed through a provider-backed
            verification mechanism. Not implemented yet. Pairing a collector authenticates who
            sent the data, not that the underlying local records are untampered.
          </p>
          <p>
            <strong>Project detected</strong> vs. <strong>project linked</strong> — a detected
            project just means AI activity was associated with a local workspace; a linked project
            additionally has a builder-supplied URL. Neither implies the project shipped or is
            complete.
          </p>
        </Section>

        <Section title="Privacy">
          <p>
            Signing in identifies you here. It never grants this app access to your Claude,
            ChatGPT, or OpenCode accounts. No prompts, generated content, source code, full file
            paths, or credentials are ever uploaded — connectors read only usage metadata (token
            counts, model, timestamps). Nothing is public until you explicitly publish it, project
            by project and as a whole.
          </p>
        </Section>

        <Section title="No prizes, no fraud-proof claims">
          <p>
            This is a friendly community leaderboard with basic anomaly awareness, not a
            fraud-proof competition. There are no prizes in this release.
          </p>
        </Section>
      </div>
    </div>
  );
}
