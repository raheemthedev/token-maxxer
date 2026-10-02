# Privacy and evidence model

## What never leaves the machine

- Keyboard events. Never collected, for anything, by this product.
- Prompt text, generated content, tool inputs/outputs, source code, full file paths, raw session
  logs, credentials, or private repository URLs.
- The real value of a project's local path — only a salted one-way hash of it
  (`hashProjectFingerprint`, `packages/shared/src/fingerprint.ts`) crosses the wire, and the salt
  itself is a local pairing secret, not something either party publishes.
- Any file/session content needed only to compute a token count. Connectors read the smallest set
  of fields that carries `usage`/`model`/`timestamp`/`sessionId`/`cwd`-equivalent metadata and
  explicitly skip content fields (see docs/SUPPORT_MATRIX.md).

The owner’s private dashboard receives a redacted folder basename to help identify projects.
It never receives a full path, and that hint never appears in public profiles or leaderboards.

## Identity vs. access

Signing in with GitHub or email identifies a person in Token Maxxer. It grants **no** access to
their Claude, ChatGPT, OpenCode, or any other provider account, even if the email addresses match.
There is no email-matching account discovery anywhere in this codebase — usage only ever enters
the system through an explicitly paired collector's authenticated upload.

GitHub OAuth is requested with the minimum scope needed for sign-in and a display name/avatar —
not `repo` — so signing in never grants this app access to private repositories.

## Evidence levels

Every `UsageEvent` carries an `evidenceLevel`:

- `locally_reported` — received from a user's own paired collector or local records. This is the
  only level the connectors in this release can produce.
- `provider_verified` — would mean confirmed through a provider-backed verification mechanism.
  **Not implemented in this release.** A paired collector authenticates *who sent the data*; it
  says nothing about whether the local records it read were altered before upload. Nothing in this
  codebase should ever mark collector-sourced data `provider_verified`.

Project state carries its own, separate labels: **project detected** (activity associated with a
workspace) vs. **project linked** (the user supplied an evidence URL). Neither implies the project
shipped, is complete, or is owned by the person who linked it beyond their own assertion.

## Publishing model

Two independent switches, both off by default:

1. `PublishSettings.isPublic` — whether the user appears on the leaderboard / has a public profile
   at all.
2. `Project.visibility` — per project, whether that specific project is shown publicly.

A newly detected project is always private (`visibility: "private"`) regardless of the user's
overall publish state. Nothing about a project becomes public until the user explicitly approves
that project. Detected local folder names (`detectedNameLocal`) are never returned by any public
API route or rendered on any public page — only the user-approved `displayName` is.

## Data controls

The private dashboard (`/dashboard`) provides, at minimum:

- Collector list with per-collector revoke.
- Per-project visibility/hide/rename/merge controls and a public-profile preview before publish.
- An unpublish control that flips `PublishSettings.isPublic` back off.
- Account/data deletion, which cascades to collectors, projects, and usage events
  (`onDelete: Cascade` in `prisma/schema.prisma`).

## Diagnostics

Collector diagnostics (status, last-seen time, detected tools, error messages) intentionally
never include prompt/response content or full paths — see `packages/collector/src/diagnostics.ts`.
