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

The app is Postgres-only (Neon, provisioned via Vercel's marketplace integration in production) —
set `DATABASE_URL` to a Postgres connection string before step 3 below. A free Neon project works
fine for local dev too; reuse the same one your deployment uses, or create a separate one. Left
empty, the app still boots — every page just shows a "database not configured" notice instead of
crashing. Sign-in shows as "not configured" until you add credentials, and email magic links print
to the server console instead of sending, until `EMAIL_SERVER`/`EMAIL_FROM` are set.

To turn on real sign-in:

- **GitHub OAuth**: create an OAuth app at <https://github.com/settings/developers> with callback
  URL `http://localhost:3000/api/auth/callback/github` (or your deployed domain's equivalent), then
  set `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`. Only the default `read:user` scope is requested —
  this app never asks for `repo` access.
- **Email sign-in**: set `EMAIL_SERVER` (an SMTP connection string) and `EMAIL_FROM`.
- Set a real `AUTH_SECRET` (e.g. `openssl rand -base64 32`) before deploying anywhere public.

## 3. Database

```bash
npm run db:push     # sync the schema to your Postgres database
npm run db:seed      # load synthetic demo fixtures (handles prefixed demo-*, clearly labeled in the UI)
```

`db:seed` is idempotent — it deletes and recreates rows for handles starting `demo-` each time.

## 4. Run

```bash
npm run dev
```

Visit `http://localhost:3000` — the leaderboard should show the seeded `demo-*` rows with a
"Demo data" badge. Sign in (once GitHub or email is configured) to reach `/dashboard`.

## 5. Try tracking your own real usage (optional)

Both paths upload *your own* real Claude Code / OpenCode usage metadata — only do this against a
server you control, and only once you're comfortable with what docs/PRIVACY.md says is and isn't
collected.

**Automatic (recommended):** Dashboard → Collector → "Generate setup snippet", then paste the
result into either your shell profile (`~/.zshrc` etc. — works if Claude Code is launched from a
terminal) or `~/.claude/settings.json`'s `"env"` key (more reliable if Claude Code is launched
through a GUI app, since shell profiles aren't always sourced by GUI-launched processes). Then
start a *new* Claude Code session — env vars only apply to processes started after they're set, so
an already-running session won't pick them up retroactively. If you use the desktop app, fully quit
and reopen it first.

**Checking that it works:** the collector list (Dashboard → Collector) shows a "Last upload" note
for each collector, e.g. `saw claude_code.session.count×1 → 0 usage event(s)`. Claude Code reports
`session.count` as soon as a session starts, so within about a minute of starting a new session you
should see the note appear even before any tokens are used; `claude_code.token.usage` follows once a
request has been made. "Nothing received yet" means no export has reached the server at all — the
new session didn't pick up the config (restart the app / open a new terminal), or the snippet's
token was revoked.

**Manual (advanced, required for OpenCode):**

```bash
# In the dashboard: Dashboard → Collector → "Advanced" → "Generate pairing code"
npm run collector -- pair --server http://localhost:3000 --code <code-from-dashboard>
npm run collector -- status     # see what it detected
npm run collector -- run --once # collect once and upload
```

## 6. Deploying

### Database

1. Provision Postgres. On Vercel: Project → Storage → Create Database → Neon (free tier, no card
   required) → Connect Project. This sets `DATABASE_URL` (and several `DATABASE_*` sibling vars
   from Neon) in your Vercel project automatically.
2. `apps/web/package.json`'s `build` script runs `prisma db push` automatically on every Vercel
   build (guarded by Vercel's own `VERCEL=1` env var — see `scripts/db-push-on-vercel.mjs`), so the
   schema stays in sync with no extra step. This is a pre-migrations convenience for this early
   stage; switch to `prisma migrate deploy` before this matters for real user data.

### Vercel

1. Push this repo to GitHub.
2. Import it into Vercel. Because it's an npm-workspaces monorepo, either set the project's **root
   directory** to `apps/web` in the dashboard, or (what this project actually uses) keep the root
   directory as `.` and set custom **Install/Build/Output** commands:
   - Install: `npm install`
   - Build: `npm run build --workspace apps/web`
   - Output directory: `apps/web/.next`
3. Add the database (see above), and set `AUTH_SECRET`, `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`,
   `EMAIL_SERVER`/`EMAIL_FROM`, `COLLECTOR_TOKEN_SECRET` in the Vercel project's environment
   variables.
4. Create a GitHub OAuth app at <https://github.com/settings/developers> with callback URL
   `https://<your-vercel-domain>/api/auth/callback/github`, and set its client ID/secret as
   `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET` above.
5. Deploy. Re-run `npm run db:seed` locally against the production `DATABASE_URL` only if you want
   the demo leaderboard rows there too — most real deployments should skip seeding.

Nothing in this repository deploys itself — see docs/PRIVACY.md and the top of the build brief for
why (no telemetry is enabled, no real usage is uploaded, and no deployment happens without a human
explicitly running the steps above).

## What's implemented vs. deferred in this release

- ✅ **Live in production**: real Postgres (Neon), real GitHub OAuth, deployed at
  token-maxxer-ten.vercel.app with auto-deploy from `main` — not just a local demo.
- ✅ GitHub + email sign-in (Auth.js v5); email has no real SMTP provider configured, so magic
  links print to server logs rather than send — everything else works.
- ✅ Automatic (OTel) tracking: paste-once setup, no process to run. End-to-end verified against
  production with real requests — bucket merging, idempotent dedup, cumulative-counter upsert, and
  cross-session summing all confirmed correct, not just unit-tested.
- ✅ CLI collector (advanced path): pairing, revocation, idempotent ingestion, still required for
  OpenCode or more precise (path-level) project attribution.
- ✅ Automatic project detection (git root → workspace folder for the CLI path; repo name via
  `vcs.*` attributes for the OTel path), rename/hide/merge/link, publish preview and explicit
  publish toggle.
- ✅ Weekly/daily/all-time leaderboard, public profiles, documented accounting rule, graceful
  degradation (not a crash) if the database is ever unreachable.
- ✅ Claude Code connectors: OTel (recommended) and local JSONL transcripts (advanced/manual).
- ⚠️ OpenCode connector: implemented against the public CLI surface only, from documentation
  review — **needs validation against a real `opencode` install** before you rely on it (see
  docs/SUPPORT_MATRIX.md).
- ❌ Provider-verified evidence level, Zed/other connectors, direct provider API integration —
  deferred, see the build brief §14.
