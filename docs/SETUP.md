# Setup and operations

## Local development

Run `npm install` then `npm run dev`. If `DATABASE_URL` is absent, the development runner starts bundled PostgreSQL on loopback port 55432, keeps its data under ignored `.local/postgres`, creates random local secrets, preserves existing `.env.local` values, and pushes the schema. Stop the runner to stop its database. If port 3000 is occupied, Next.js prints the actual port to use.

To use your own database instead, set `DATABASE_URL` in `apps/web/.env.local`. The runner uses that database and does not start the bundled one. `npm run db:seed` is optional and creates clearly labelled synthetic fixtures; do not run it against production unless you intentionally want demo data.

Development-only email links are printed to the terminal. No production email link is silently logged instead of being delivered.

## Production configuration

Set these in Vercel (or the chosen production host):

- `DATABASE_URL`: PostgreSQL connection string.
- `AUTH_SECRET`: a random secret, e.g. `openssl rand -base64 32`.
- `COLLECTOR_TOKEN_SECRET`: another independently generated secret. Preserve it across deployments; rotating it invalidates existing collector tokens.
- `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`: GitHub OAuth credentials. Callback: `https://YOUR_DOMAIN/api/auth/callback/github`. Only profile/email scopes are requested.
- Optional `EMAIL_SERVER` and `EMAIL_FROM`: SMTP transport and sender for real email sign-in. With neither configured, use GitHub; the email form is hidden in production.
- Optional `AUTH_URL`: canonical public origin, useful behind proxies. Vercel hosts are trusted automatically; other hosts must explicitly set `AUTH_TRUST_HOST=true` when their proxy is trusted.

Existing `.vercel/project.json` identifies this repository's deployment. Keep the monorepo root as `.`; install with `npm install`, build with `npm run build`, output `apps/web/.next`. The build creates the standalone collector and download checksum, generates Prisma, and on Vercel pushes the additive schema changes. Schema push is an early-stage convenience; use reviewed Prisma migrations before managing larger production datasets.

Before inviting people, verify `GET /api/health` returns 200, GitHub OAuth completes against the actual domain, and a synthetic collector upload appears in a private dashboard. A successful build alone does not prove external credentials work.

## End-user setup

The **Connect tools** page generates a one-use code valid for ten minutes. Its macOS/Linux or Windows command downloads a standalone collector from the same host, checks its checksum, pairs it, and installs background tracking. Users need Node.js 20+. Linux users also need a running cron service. Credentials are stored in the user's private `.token-maxxer` folder, never in a scheduled command or service definition.

The collector sends a heartbeat every five minutes even when there are no new tokens. The browser polls its own authenticated status every five seconds and shows waiting, receiving, stale, revoked and tool-specific states. Sleeping machines naturally appear stale; they retry after waking. Unsupported tools do not block supported ones.

Commands (replace `~` with the user folder on Windows):

```sh
node ~/.token-maxxer/collector.cjs status
node ~/.token-maxxer/collector.cjs run --once
node ~/.token-maxxer/collector.cjs pause
node ~/.token-maxxer/collector.cjs resume
node ~/.token-maxxer/collector.cjs stop
node ~/.token-maxxer/collector.cjs unpair
```

`stop` removes automatic startup and keeps pairing/data. `unpair` also removes local pairing and pending metadata. Server revocation blocks the token immediately. Account/data deletion remains an explicit user action.

## Updating existing collectors

Download and rerun the current install command. Pairing the same account with its existing bearer token refreshes the same collector rather than leaving a duplicate. Switching accounts requires the explicit `--replace` option.

For a machine that is already paired and just needs background startup or an update, run the installer with `--server https://YOUR_DOMAIN` and omit `--code`. It preserves the existing pairing.

The first upgraded Codex scan replaces old session-total records with complete daily/model/project partitions. Old cumulative records without recoverable timing are retained in all-time totals but excluded from daily/weekly rankings. OTel checkpoints preserve the old baseline and add subsequent differences; they do not fabricate prior daily history. See ACCOUNTING.md.

## Alternative Claude-only telemetry

The alternative section generates a settings-merging terminal command for macOS/Linux. It backs up existing Claude settings, enables HTTP/JSON metrics with delta temporality, disables logs and traces, and sets a metrics-specific authorization header. Start a new Claude session after applying it. There is no historical backfill. Do not combine this with Claude transcript collection; the server prevents overlapping uploads from being counted.

## Verification

`npm run check` runs lint, collector type checking, isolated PostgreSQL regression tests, telemetry parser tests and a production build. CI is configured for macOS, Linux and Windows. Native Windows/Linux scheduler execution must also be checked on those platforms; unit-tested generated commands alone do not establish end-to-end support there.
