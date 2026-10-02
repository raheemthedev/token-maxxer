# Onboarding repair verification — 2026-10-01

`npm run check` passed: lint, collector TypeScript, 26 regression tests, the existing OTLP checks, and the Next.js production build. Regression tests use isolated PostgreSQL and synthetic usage. The owner subsequently authorized real local detection; the private local preview now uses actual Claude Code, Codex and OpenCode metadata.

Verified locally:

- Development email sign-in, single-use pairing, installer download checksum, initial upload and dashboard polling.
- A real macOS launch agent collecting a changed synthetic Codex log without an open terminal. The temporary test service was removed afterward.
- Offline queue persistence, replay idempotency across collectors, delayed/reset cumulative counters, UTC day/week attribution and legacy Codex replacement.
- Installed OpenCode 1.18.30: global history across project IDs, child sessions, and more than 500 newer sessions with identical timestamps.
- Claude metadata privacy/validation and active/archived Codex JSONL history.
- Real history from all three detected tools imported into a separate private local account. The production pairing was preserved. A macOS launch agent now refreshes this local account every five minutes; its first real upload succeeded.
- Codex restored cumulative totals, repeated readings and overlapping retained pages. A fixed snapshot of actual token metadata matched an independent response-level sum exactly.
- OpenCode detection includes help written to stderr. An older server fails the accounting compatibility check before any usage is uploaded.
- Project name/link publication in one update, private preview, account publish/unpublish, and exclusion of private detected names from public HTML.
- Onboarding, dashboard and preview on a narrow viewport without document overflow; command copying; consistent upload-date hydration.
- Local readiness endpoint (200), unauthenticated collector status rejection (401), private-profile not-found view, and all installer/download endpoints.

Before onboarding production users:

- Deploy the reviewed changes and accounting schema, then verify production readiness, GitHub OAuth and an authenticated collector upload using synthetic fixtures.
- Configure SMTP if email sign-in is desired; otherwise production offers GitHub only.
- Run native Linux/Windows background-startup checks. Definitions and a cross-platform CI matrix are prepared; native execution was verified on macOS only.
- Compressed Codex `.jsonl.zst` history is explicitly reported as unsupported. No usage is estimated for missing or unreadable history.

Production was not modified. A read-only Vercel environment preflight returned HTTP 403 with the available CLI credential, so production configuration remains unverified.
