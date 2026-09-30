# Connector support matrix

Recheck this against upstream docs/source before relying on it — both projects can change
their schemas without notice, and neither treats these as a stable public API for third parties.

| | Claude Code (OTel — recommended) | Claude Code (CLI collector — advanced) | OpenCode |
| --- | --- | --- | --- |
| **Status** | Implemented | Implemented (local JSONL transcripts) | Implemented against public CLI surface only; **needs validation** against a real install before enabling by default |
| **Setup** | Paste a one-time env-var snippet (dashboard → Collector → "Generate setup snippet") into your shell profile | Clone the repo, run the CLI collector (`pair`, then `run`/`run --once`) | `opencode` installed and on `PATH`; if its stats command doesn't support machine-readable output, this connector reports `unsupported` rather than guessing |
| **After setup** | Nothing — Claude Code exports automatically on every session, no process to keep running | Must run `run` continuously (or re-run `run --once`) to upload | Same as CLI collector — manual `run`/`run --once` |
| **Data source** | Claude Code's built-in OTLP/HTTP-JSON metrics export, received at `/api/otel/v1/metrics` | Local session transcript files (see below) | `opencode` CLI stats output — **not** its internal SQLite/state file, per the brief's own caution against depending on an undocumented internal schema |
| **Token categories** | input, output, cache read, cache write, from the `claude_code.token.usage` counter's `type` attribute. Reasoning billed as part of output (`reasoning = null`, `reasoningIncludedInOutput = true`) | Same categories, read directly from each transcript line's `usage` object | input, output, reasoning, cache read/write — OpenCode's own stats already separate these |
| **History availability** | Only from when the snippet is added onward (no backfill) | Full local history (all retained transcript files) | Whatever window the CLI's stats command exposes |
| **Project attribution** | `vcs.owner.name`/`vcs.repository.name` data-point attributes (confirmed against a real Claude Code 2.1.284 process; resource-level is also accepted), when `OTEL_METRICS_INCLUDE_REPOSITORY=true` is set (in the generated snippet) and the session is inside a repo with a recognized remote — otherwise unassigned. Repo-level only, no path/workspace-folder fallback | `cwd` field on each transcript line → git root (via local `git rev-parse`) → workspace folder fallback. More precise than the OTel path | Session's `projectID`/`Project.Info` from OpenCode's own stats output, when present; otherwise unassigned |
| **Stable event id** | Derived from `session.id` + `model` (cumulative counters) or `session.id` + `model` + timestamp (delta counters) — see docs/ACCOUNTING.md | Assistant message `requestId` (falls back to message `uuid`) | Session id + message index (best effort; flagged `locally_reported`, never `provider_verified`) |
| **Content excluded** | Only numeric metric data points and the listed attributes are read — Claude Code's own `OTEL_LOG_*` content-inclusion flags are never enabled by the generated snippet, so no prompt/tool content is ever exported in the first place | `message.content` (prompt/response text), tool inputs/outputs — connector reads only `usage`, `model`, `cwd`, `sessionId`, `timestamp`, `requestId`/`uuid` | Connector only reads the stats command's numeric/metadata output, never raw session content |
| **Evidence level** | `locally_reported` | `locally_reported` | `locally_reported` |
| **Known limitations** | Only `http/json` protocol is supported (not gRPC or `http/protobuf`, to avoid a protobuf dependency); attribution is coarser than the CLI path (repo-level, not path-level); OTLP payload shapes aren't a versioned public contract either — recheck against Claude Code's docs periodically | Requires the machine's local transcript files to still exist (Claude Code retention policy, not ours); requires a process to be run/kept running | Entirely dependent on the `opencode` CLI exposing a stable, scriptable stats surface; if the real CLI has no such flag, this connector should be treated as a documented gap, not implemented against a guessed internal DB schema |

Both Claude Code paths write to the same accounting rules and the same `UsageEvent` table — a user
could technically enable both, but should not, since Anthropic doesn't guarantee the two surfaces
report identical numbers for the same requests and nothing here reconciles them against each other.
The dashboard presents OTel as the default and the CLI collector as "Advanced" specifically to keep
most users on a single, consistent path.

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

## Codex CLI (CLI collector only)

Reads `~/.codex/sessions/**/rollout-*.jsonl`, streaming line by line (single files reach hundreds
of MB). Each `token_count` event carries a cumulative `total_token_usage`, so one
`cumulative_snapshot` per thread is emitted (key: the thread `id`; subagent "guardian" threads share
the parent's `session_id` but keep their own counters, so `session_id` must not be used as the key).
OpenAI semantics differ from Anthropic's: `input_tokens` **includes** cached input and
`output_tokens` includes reasoning, so buckets are made exclusive (input − cached, cacheRead =
cached, reasoning folded into output). Verified against an independent count of the same local
logs: exact match (19 threads, 922,394,091 tokens). No OTel path exists for Codex. Not supported:
the ChatGPT app (no token counts exposed).

## Later candidates (not implemented this release)

- **Zed** — model access can go through provider APIs, Zed-hosted access, or external agents;
  each has different usage-reporting characteristics and needs separate validation.
- **Direct provider APIs** (e.g. Anthropic Admin/usage APIs) — real per-organization usage data,
  but requires a separate authorized integration and is explicitly not the preferred first flow
  (brief §2, §7).
- **ChatGPT / Claude consumer apps** — no reliable authorized usage interface exists; message
  counts and plan limits are not token counts and must not be presented as such.
