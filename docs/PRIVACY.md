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
It never receives a full path. When the owner publishes their account, non-hidden folder project names
(including those basenames) appear on the leaderboard and profile. Private projects have no hyperlinks
and their descriptions and URLs are excluded from public responses. Hide a project to omit its name.

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

Accounts start unpublished. `PublishSettings.isPublic` controls whether a user appears on the
leaderboard or has a public profile. Once published, all confirmed, non-hidden, non-merged folder project names appear.
An owner-supplied `displayName` takes precedence over the redacted detected basename.

`Project.visibility` controls outbound links and descriptions: private projects show names without
links or descriptions; public projects can link to an owner-supplied URL or a discovered public GitHub
repository. `Project.hidden` excludes a project entirely, in both states. Visibility never changes
account totals, and discovering a link never publishes an account or makes a project public.

The collector reads only the local Git origin metadata for detected repositories. It accepts standard
GitHub remotes and checks `api.github.com/repos/{owner}/{repo}` **without authentication**, with redirects
disabled. Only exact repository matches explicitly reported public are uploaded. Private repository
URLs, embedded credentials, custom hosts and unverified links never reach Token Maxxer. Discovery is
bounded, cached and optional; failures do not prevent usage uploads. Manually entered links always
win over automatic discovery. No repository contents are fetched and GitHub OAuth scopes are unchanged.

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

## Folder projects and chats

A project must have confirmed local folder evidence. Codex desktop uses saved folder projects and
thread membership; projectless chats are excluded even when their session has a working directory.
Claude Code and OpenCode share the same filesystem checks: home/root directories, missing paths,
agent storage and temporary chat output are not projects. Actual repositories and explicitly saved
folders can reside in temporary locations. Chat token usage remains part of account totals, with no
project attribution. Existing unconfirmed project rows are retained for history but excluded from
the dashboard, profile and leaderboard until a current collector confirms them.

The collector keeps historical Codex event identities stable when folder attribution changes, so
replaying history cleans up project assignments without counting tokens twice.
