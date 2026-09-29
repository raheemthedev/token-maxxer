# Token Maxxer

A public leaderboard for people who consume AI tokens while building things. Show your usage.
Show what you shipped.

**Live:** <https://token-maxxer-ten.vercel.app>
**Repo:** <https://github.com/raheemthedev/token-maxxer>

Built from [claude-token-maxxer-build-brief.md](./claude-token-maxxer-build-brief.md).

## Quick start (local dev)

```bash
npm install
cp apps/web/.env.example apps/web/.env
# set DATABASE_URL in apps/web/.env to a Postgres connection string (a free Neon project works)
npm run db:push
npm run db:seed
npm run dev
```

Then open <http://localhost:3000>. Full setup (real sign-in, deploying, trying the collector
against real usage) is in [docs/SETUP.md](./docs/SETUP.md).

## What this is

- **Public leaderboard** (`/`) — weekly/daily/all-time token totals for builders who've opted in.
- **Public profiles** (`/u/[handle]`) — approved aggregate usage, tool/model breakdowns, linked
  projects.
- **Private dashboard** (`/dashboard`) — collector setup, detected projects (rename, hide, merge,
  link, publish), publish/unpublish, account deletion.
- **Automatic tracking (recommended)** — paste a one-time env-var snippet from the dashboard into
  your shell profile or `~/.claude/settings.json`; Claude Code then reports usage on every session
  automatically via OpenTelemetry, no process to run or keep alive.
- **Local collector CLI** (`packages/collector`, advanced) — pairs with your account, detects
  Claude Code / OpenCode locally by reading local files, uploads usage metadata only. Still
  required for OpenCode, or for more precise (path-level, not just repo-level) project attribution.

## Stack

Next.js (App Router) + TypeScript + Tailwind, Prisma + Postgres (Neon), Auth.js v5 (GitHub +
email), npm workspaces monorepo. See [docs/SETUP.md](./docs/SETUP.md) for why.

## Docs

- [docs/ACCOUNTING.md](./docs/ACCOUNTING.md) — token counting rules, the headline-total formula,
  duplicate-count prevention, and how the OTel receiver handles cumulative vs. delta counters.
- [docs/SUPPORT_MATRIX.md](./docs/SUPPORT_MATRIX.md) — what each connector (OTel, CLI collector,
  OpenCode) supports today, and known limitations of each.
- [docs/PRIVACY.md](./docs/PRIVACY.md) — what never leaves the machine, evidence levels, publishing
  model.
- [docs/SETUP.md](./docs/SETUP.md) — install, env vars, deploying to Vercel, what's implemented vs.
  deferred.

## Status

**Live in production, real infrastructure, not just a demo:**

- Real Postgres (Neon, via Vercel's marketplace integration) — no more dev-only SQLite.
- Real GitHub OAuth sign-in (an OAuth app was created and wired in; email magic-link sign-in also
  works but has no real SMTP provider configured, so links print to server logs rather than send).
- Automatic (OTel) tracking end-to-end verified against production with real requests: correct
  token-bucket merging, idempotent duplicate rejection, cumulative-counter upsert (not additive),
  and cross-session summing all confirmed working, not just unit-tested.
- Claude Code (local JSONL transcripts) and OpenCode connectors implemented in the CLI collector;
  OpenCode's connector still needs validation against a real `opencode` install (see
  docs/SUPPORT_MATRIX.md).
- Leaderboard/profile pages fail gracefully (not a crash) if the database is ever unreachable.

**Known gaps:** OpenCode connector unvalidated against a real install; no real email-sending
provider configured (magic links work, just don't get emailed anywhere yet); no `provider_verified`
evidence level (nothing here claims stronger verification than "locally reported"); Zed and direct
provider-API connectors are deferred scope per the brief.
