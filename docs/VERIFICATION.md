# Onboarding repair verification — 2026-10-02

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

Production verification:

- Commit `33ecb53` was pushed to `main` and deployed by the linked Vercel project to `https://token-maxxer-ten.vercel.app/`. GitHub reports the deployment completed successfully.
- GitHub Actions checks passed on macOS, Linux and Windows. These checks cover tests and production builds; native background scheduling was exercised on macOS.
- Live `/api/health` returns 200 with database, authentication, ingestion and accounting version 2 ready. GitHub is the configured sign-in method; SMTP is not configured and email sign-in is hidden.
- Both platform installers and the bundled collector are downloadable. The production collector's SHA-256 matches its published checksum. Anonymous collector-status requests return 401.
- The production installer upgraded the owner's existing Mac pairing without changing its credential, collector ID or project salt. Real usage uploaded successfully, the outbox emptied, and a subsequent native launch-agent cycle succeeded. The live public aggregate includes all three detected tools; detected project names remain private.
- The temporary local-preview background job was stopped after switching to production tracking; local preview data was preserved.
- The production GitHub sign-in button redirects to the correct Token Maxxer OAuth app and production callback with read-only profile/email scopes. Completing that sign-in and verifying a fresh dashboard-issued pairing command requires the owner to finish GitHub login in the browser; it is not yet recorded as a completed end-to-end sign-up test.

Remaining verification:

- Complete the browser GitHub callback, then exercise a dashboard-issued pairing command and receiving-status polling.
- Configure SMTP if email sign-in is desired; otherwise production offers GitHub only.
- Run native Linux/Windows background-startup checks. Definitions and a cross-platform CI matrix are prepared; native execution was verified on macOS only.
- Compressed Codex `.jsonl.zst` history is explicitly reported as unsupported. No usage is estimated for missing or unreadable history.

The saved Vercel CLI credential returned HTTP 403. Deployment succeeded through the existing GitHub integration; live health and authenticated collector responses verify readiness without exposing production environment values.
