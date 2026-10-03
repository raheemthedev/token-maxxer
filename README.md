# Token Maxxer

A private-by-default AI usage tracker and public community leaderboard. Show your usage. Show what you shipped.

Live: https://token-maxxer-ten.vercel.app

## User onboarding

1. Sign in with GitHub (or email when the operator has configured delivery).
2. Open **Connect tools**, generate the install command, and paste it into a terminal on your coding machine.
3. The collector pairs, imports retained Claude Code / Codex / OpenCode usage, and installs background tracking every five minutes. Node.js 20+ is required; no repository clone or open terminal is needed.
4. The page confirms **Receiving uploads** and shows each tool's coverage.
5. Review **Profile preview** and publish your account. All non-hidden project names appear; private projects have no links. Make a project public to enable its link, or hide it to omit it entirely.

macOS uses a launch agent, Linux uses the user's crontab (requires cron), and Windows uses a scheduled task. The collector queues metadata locally while offline and retries. Stop, pause, unpair and revoke controls are included.

## Development

```sh
npm install
npm run dev
```

When no database is configured, development starts an isolated local PostgreSQL server automatically and syncs the schema. Development-only email links print in the terminal. This never uploads local AI usage or enables telemetry by itself.

```sh
npm test       # isolated PostgreSQL, accounting/privacy/retry regression tests
npm run check # lint, collector typecheck, tests, production build
```

## Counting

Headline total = fresh input + output + cache read + cache write + reasoning (only when not already included in output). Codex input/cache and OpenCode reasoning are normalized to exclusive buckets. Daily and weekly views use UTC; weeks start Monday. Codex history is partitioned by day, model and project. Cumulative telemetry contributes differences between checkpoints, not a lifetime total moved to the latest day. Unknown historical timing stays in all-time totals and is excluded from period rankings.

Records deduplicate across collectors within an account. Claude Code transcript collection and telemetry are alternative methods: one canonical method is counted; existing overlapping evidence is retained but excluded from totals. Evidence is **locally reported**, never provider verified.

## Operations and support

- [Setup and deployment](docs/SETUP.md)
- [Connector support](docs/SUPPORT_MATRIX.md)
- [Accounting and upgrade rules](docs/ACCOUNTING.md)
- [Privacy](docs/PRIVACY.md)

Production requires a configured PostgreSQL database, authentication credentials and real secrets. `GET /api/health` returns 200 only when these are configured and the accounting schema is available. Email sign-in is hidden in production until SMTP delivery is configured.
