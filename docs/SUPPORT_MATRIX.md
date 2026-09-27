# Connector support matrix

Recheck this against upstream docs/source before relying on it — both projects can change
their schemas without notice, and neither treats these as a stable public API for third parties.

| | Claude Code | OpenCode |
| --- | --- | --- |
| **Status** | Implemented (local JSONL transcripts) | Implemented against public CLI surface only; **needs validation** against a real install before enabling by default |
| **Detection** | `~/.claude/projects/**/*.jsonl` present | `opencode` binary present on `PATH` |
| **Data source** | Local session transcript files (see below) | `opencode` CLI stats output (see below) — **not** its internal SQLite/state file, per the brief's own caution against depending on an undocumented internal schema |
| **Setup required** | None beyond having used Claude Code locally | `opencode` installed and on `PATH`; if its stats command doesn't support machine-readable output, this connector reports `unsupported` rather than guessing |
| **Token categories** | input, output, cache read, cache write. Reasoning/thinking tokens are billed as part of output for current Claude models, so `reasoning = null`, `reasoningIncludedInOutput = true` | input, output, reasoning, cache read/write — OpenCode's own stats already separate these |
| **History availability** | Full local history (all retained transcript files) | Whatever window the CLI's stats command exposes (typically recent sessions) |
| **Project attribution** | `cwd` field on each transcript line → git root (via local `git rev-parse`) → workspace folder fallback | Session's `projectID`/`Project.Info` from OpenCode's own stats output, when present; otherwise unassigned |
| **Stable event id** | Assistant message `requestId` (falls back to message `uuid`) | Session id + message index (best effort; flagged `locally_reported`, never `provider_verified`) |
| **Content excluded** | `message.content` (prompt/response text), tool inputs/outputs — connector reads only `usage`, `model`, `cwd`, `sessionId`, `timestamp`, `requestId`/`uuid` | Connector only reads the stats command's numeric/metadata output, never raw session content |
| **Evidence level** | `locally_reported` | `locally_reported` |
| **Known limitations** | Requires the machine's local transcript files to still exist (Claude Code retention policy, not ours); doesn't currently attempt the OTel-metrics path (see below) | Entirely dependent on the `opencode` CLI exposing a stable, scriptable stats surface; if the real CLI has no such flag, this connector should be treated as a documented gap, not implemented against a guessed internal DB schema |

## Claude Code: why local JSONL transcripts, not OTel

Claude Code also supports an OpenTelemetry pipeline (`CLAUDE_CODE_ENABLE_TELEMETRY=1` plus
`OTEL_METRICS_EXPORTER`/`OTEL_EXPORTER_OTLP_ENDPOINT` etc.) exporting a `claude_code.token.usage`
counter with `type` (`input`/`output`/`cacheRead`/`cacheCreation`) and `model` attributes. We did
not build the first connector on this path because:

1. It requires the user to already run (or stand up) an OTLP collector endpoint — real setup
   friction for a "pair once" flow.
2. Per Anthropic's own docs, the standard metric attributes do not include a working directory or
   git repository by default (`vcs.repository.*` attributes exist but are opt-in and org-wide, not
   something an individual contributor can flip on their own).
3. The local JSONL transcripts (`~/.claude/projects/*/*.jsonl`) already carry `cwd` on every line,
   which gives us project attribution "for free" without asking the user to configure anything —
   directly satisfying the brief's top attribution priority (session metadata / working directory).

The OTel path is documented here as a legitimate later option (e.g. for org-wide deployments that
already run a collector), not implemented in this release. **Only pick one path per user** if it's
ever added — do not sum OTel-reported and transcript-reported tokens together.

## OpenCode: why not the internal database directly

OpenCode's `stats` CLI command reads directly from its own internal session/message store (an
Effect-based `SessionTable` in local storage). That internal schema is not a published, versioned
public API — the brief is explicit that "an internal database schema is [not] a stable public
API." The connector in this repo therefore only shells out to the public `opencode` CLI and parses
its output; if a future OpenCode release doesn't offer a machine-readable stats flag, the connector
degrades to `status: "unsupported"` with clear setup guidance rather than reaching into internal
storage. **Action item before enabling this connector for real users:** confirm the exact flag/JSON
shape against a real `opencode` install, since this was implemented from documentation review, not
a live install (none was available in this environment).

## Later candidates (not implemented this release)

- **Zed** — model access can go through provider APIs, Zed-hosted access, or external agents;
  each has different usage-reporting characteristics and needs separate validation.
- **Direct provider APIs** (e.g. Anthropic Admin/usage APIs) — real per-organization usage data,
  but requires a separate authorized integration and is explicitly not the preferred first flow
  (brief §2, §7).
- **ChatGPT / Claude consumer apps** — no reliable authorized usage interface exists; message
  counts and plan limits are not token counts and must not be presented as such.
