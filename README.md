# Token Maxxer

A public leaderboard for people who consume AI tokens while building things. Show your usage.
Show what you shipped.

Built from [claude-token-maxxer-build-brief.md](./claude-token-maxxer-build-brief.md).

## Quick start

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
- **Private dashboard** (`/dashboard`) — collector pairing, detected projects (rename, hide, merge,
  link, publish), publish/unpublish, account deletion.
- **Local collector CLI** (`packages/collector`) — pairs with your account, detects Claude Code /
  OpenCode locally, uploads usage metadata only (never prompts, code, or full paths).

## Stack

Next.js (App Router) + TypeScript + Tailwind, Prisma + Postgres (Neon), Auth.js v5 (GitHub +
email), npm workspaces monorepo. See [docs/SETUP.md](./docs/SETUP.md) for why.

## Docs

- [docs/ACCOUNTING.md](./docs/ACCOUNTING.md) — token counting rules, the headline-total formula,
  and how duplicate counting is prevented.
- [docs/SUPPORT_MATRIX.md](./docs/SUPPORT_MATRIX.md) — what each connector supports today, and why
  the OTel path / internal-DB path were deliberately not used.
- [docs/PRIVACY.md](./docs/PRIVACY.md) — what never leaves the machine, evidence levels, publishing
  model.
- [docs/SETUP.md](./docs/SETUP.md) — install, env vars, deploying to Vercel, what's implemented vs.
  deferred.

## Status

First end-to-end slice, built against clearly-labeled synthetic fixtures (`demo-*` handles) plus a
real Claude Code connector. See docs/SETUP.md's final section for the exact support matrix and
known gaps (notably: the OpenCode connector needs validation against a real install).
