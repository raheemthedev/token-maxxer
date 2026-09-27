# Setup

## Layout

```
apps/web            Next.js app: leaderboard, profiles, dashboard, API routes, Prisma schema
packages/shared      Normalized usage types + accounting rules, used by both web and collector
packages/collector   Local CLI collector (Claude Code + OpenCode connectors)
docs/                ACCOUNTING.md, SUPPORT_MATRIX.md, PRIVACY.md (this file: SETUP.md)
```

npm workspaces (root `package.json`) tie the three packages together — everything installs from
the repo root.

## 1. Install

```bash
npm install
```

This also runs Prisma's `postinstall` generate step for `apps/web`.

## 2. Configure environment

```bash
cp apps/web/.env.example apps/web/.env
```

The defaults work for local development with **zero further configuration** — SQLite database,
sign-in shown as "not configured" until you add credentials, email magic links printed to the
server console instead of sent.

To turn on real sign-in:

- **GitHub OAuth**: create an OAuth app at <https://github.com/settings/developers> with callback
  URL `http://localhost:3000/api/auth/callback/github` (or your deployed domain's equivalent), then
  set `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`. Only the default `read:user` scope is requested —
  this app never asks for `repo` access.
- **Email sign-in**: set `EMAIL_SERVER` (an SMTP connection string) and `EMAIL_FROM`.
- Set a real `AUTH_SECRET` (e.g. `openssl rand -base64 32`) before deploying anywhere public.

## 3. Database

```bash
npm run db:push     # create the SQLite schema
npm run db:seed      # load synthetic demo fixtures (handles prefixed demo-*, clearly labeled in the UI)
```

`db:seed` is idempotent — it deletes and recreates rows for handles starting `demo-` each time.

## 4. Run

```bash
npm run dev
```

Visit `http://localhost:3000` — the leaderboard should show the seeded `demo-*` rows with a
"Demo data" badge. Sign in (once GitHub or email is configured) to reach `/dashboard`.

## 5. Try the collector against your own real usage (optional, local only)

This uploads *your own* real Claude Code / OpenCode usage metadata to whatever `--server` you
point it at — only do this against a server you control, and only once you're comfortable with
what docs/PRIVACY.md says is and isn't collected.

```bash
# In the dashboard: Dashboard → Collector → "Generate pairing code"
npm run collector -- pair --server http://localhost:3000 --code <code-from-dashboard>
npm run collector -- status     # see what it detected
npm run collector -- run --once # collect once and upload
```

## 6. Deploying

### Database

SQLite's file lives on ephemeral disk on serverless platforms and will not persist. Before
deploying anywhere serverless (including Vercel):

1. Provision Postgres (Vercel Postgres, Neon, or Supabase all work).
2. In `apps/web/prisma/schema.prisma`, change `datasource db { provider = "sqlite" }` to
   `provider = "postgresql"`.
3. Set `DATABASE_URL` to the Postgres connection string in your deployment's environment.
4. Run `npm run db:push` (or switch to migrations with `prisma migrate deploy` for anything past a
   first release) against that database.

### Vercel

1. Push this repo to GitHub.
2. Import it into Vercel; set the **root directory** to `apps/web` (it's an npm-workspaces
   monorepo, so Vercel needs to know where the Next.js app lives — it will still run the install
   from the repo root).
3. Set the environment variables from step 2 above (`DATABASE_URL` pointing at Postgres,
   `AUTH_SECRET`, `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`, `EMAIL_SERVER`/`EMAIL_FROM`,
   `COLLECTOR_TOKEN_SECRET`) in the Vercel project settings.
4. Update your GitHub OAuth app's callback URL to
   `https://<your-vercel-domain>/api/auth/callback/github`.
5. Deploy. Re-run `npm run db:seed` (via `vercel env pull` + local run, or a one-off script) against
   the production database only if you want the demo leaderboard rows there too — most real
   deployments should skip seeding.

Nothing in this repository deploys itself — see docs/PRIVACY.md and the top of the build brief for
why (no telemetry is enabled, no real usage is uploaded, and no deployment happens without a human
explicitly running the steps above).

## What's implemented vs. deferred in this release

- ✅ GitHub + email sign-in (Auth.js v5), explicit "not configured" states when credentials are
  missing.
- ✅ Collector pairing, revocation, and idempotent ingestion.
- ✅ Automatic project detection (git root → workspace folder), rename/hide/merge/link, publish
  preview and explicit publish toggle.
- ✅ Weekly/daily/all-time leaderboard, public profiles, documented accounting rule.
- ✅ Claude Code connector (local JSONL transcripts, metadata fields only).
- ⚠️ OpenCode connector: implemented against the public CLI surface only, from documentation
  review — **needs validation against a real `opencode` install** before you rely on it (see
  docs/SUPPORT_MATRIX.md).
- ❌ Provider-verified evidence level, Zed/other connectors, direct provider API integration —
  deferred, see the build brief §14.
