export default function AboutPage() {
  return (
    <div className="prose prose-neutral max-w-2xl dark:prose-invert">
      <h1>How counting works</h1>

      <h2>Headline total</h2>
      <p>
        <code>total = input + output + cache-read + cache-write + reasoning</code> (reasoning is
        only added separately when a source reports it as a distinct field instead of folding it
        into output — see the full rules in <code>docs/ACCOUNTING.md</code> in the repository).
      </p>
      <p>
        This is a <strong>token consumption</strong> leaderboard, not a productivity ranking.
        Different models use very different numbers of tokens to do similar work. We don&apos;t
        normalize across models, tools, or task difficulty, and raw token counts should not be
        read as a measure of skill or output quality.
      </p>

      <h2>Periods</h2>
      <p>
        All boundaries are computed in UTC. &ldquo;This week&rdquo; starts Monday 00:00 UTC.
        &ldquo;Today&rdquo; is the current UTC calendar day.
      </p>

      <h2>Evidence labels</h2>
      <ul>
        <li>
          <strong>Locally reported</strong> — received from a builder&apos;s own paired collector
          or local records. This is the only evidence level this release can produce.
        </li>
        <li>
          <strong>Provider verified</strong> — would mean confirmed through a provider-backed
          verification mechanism. Not implemented yet. Pairing a collector authenticates who sent
          the data, not that the underlying local records are untampered.
        </li>
        <li>
          <strong>Project detected</strong> vs. <strong>project linked</strong> — a detected
          project just means AI activity was associated with a local workspace; a linked project
          additionally has a builder-supplied URL. Neither implies the project shipped or is
          complete.
        </li>
      </ul>

      <h2>Privacy</h2>
      <p>
        Signing in identifies you here. It never grants this app access to your Claude, ChatGPT,
        or OpenCode accounts. No prompts, generated content, source code, full file paths, or
        credentials are ever uploaded — connectors read only usage metadata (token counts, model,
        timestamps). Nothing is public until you explicitly publish it, project by project and as
        a whole.
      </p>

      <h2>No prizes, no fraud-proof claims</h2>
      <p>
        This is a friendly community leaderboard with basic anomaly awareness, not a
        fraud-proof competition. There are no prizes in this release.
      </p>
    </div>
  );
}
