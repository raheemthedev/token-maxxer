# Token accounting rules

This document is the single source of truth for how Token Maxxer counts tokens. Every connector
and every leaderboard/profile view must follow it. If a source can't be reconciled with these
rules, the UI must say so — it must never guess or silently substitute zero.

## Buckets

Every usage record is normalized into these mutually-exclusive buckets before storage
(`packages/shared/src/usage.ts`, `TokenBuckets`):

| Bucket | Meaning |
| --- | --- |
| `input` | New (non-cached) input tokens processed |
| `output` | Generated output tokens |
| `cacheRead` | Input tokens served from a prompt cache |
| `cacheWrite` | Input tokens newly written into a prompt cache |
| `reasoning` | Reasoning/thinking tokens, **only** when the source reports them as a distinct field |

A bucket is `null`, not `0`, when the source doesn't expose that category. `null` and `0` are
never conflated anywhere in the API, database, or UI — a `null` bucket renders as "—" or
"not reported," never as a value that participates silently in a sum.

`reasoningIncludedInOutput` is a flag, not a bucket: when true, the source's `output` figure
already contains reasoning tokens, and the headline total must not add `reasoning` again.

## Headline total rule

```
total = input + output + cacheRead + cacheWrite + (reasoningIncludedInOutput ? 0 : reasoning)
```

(`packages/shared/src/usage.ts#computeHeadlineTotal`). Missing buckets contribute `0` to this
specific sum (that's a display/ranking convenience, not a claim that the true value is zero —
`hasUnknownCategories()` is checked wherever we need to flag that).

This rule assumes the four base buckets are genuinely non-overlapping for a given source. That
assumption is validated per connector, not assumed globally:

- **Claude Code** (Anthropic API usage shape): `input_tokens`, `output_tokens`,
  `cache_creation_input_tokens`, `cache_read_input_tokens` are reported as separate, non-overlapping
  counts per the Anthropic Messages API. Anthropic does not currently break out reasoning as a
  distinct token count for extended thinking — thinking tokens are billed as part of `output_tokens`
  — so the Claude Code connector sets `reasoning = null` and `reasoningIncludedInOutput = true`.
- **OpenCode**: its internal stats aggregate a `totalTokens` shape of
  `{ input, output, reasoning, cache: { read, write } }` per session/message — i.e. it already
  keeps reasoning distinct from output for providers that report it that way. The OpenCode
  connector maps this directly and sets `reasoningIncludedInOutput = false` when `reasoning` is
  populated.
- **Synthetic fixtures** used for local development declare their own bucket values explicitly
  and are labeled as synthetic everywhere they appear (see docs/SETUP.md).

If a future connector's categories can't be cleanly mapped to these buckets (e.g. a source that
only reports one blended "tokens" number), it must report every bucket except one blended field
as `null` rather than forcing a guess, and the UI's evidence indicator must show "partial
categories" for that source.

## Why not model-normalized scores

Token Maxxer is a consumption leaderboard, not a productivity leaderboard. Different models
consume very different token counts to do similar work; we do not attempt to normalize across
models, tools, or task difficulty. The public UI must not present raw token counts as a measure
of skill, output quality, or productivity — see the "headline counting rule" callout required
next to the leaderboard.

## Duplicate-count prevention

- **One canonical source per integration, in practice.** Claude Code exposes usage through two
  surfaces — OTel export and local JSONL transcripts — and this product can ingest either. Using
  both for the same machine is not blocked technically, but isn't a supported configuration either:
  Anthropic doesn't guarantee the two surfaces report identical numbers for the same requests, and
  nothing here reconciles them against each other. The dashboard presents OTel as the default and
  the CLI collector as "Advanced" specifically to steer most users onto one path.
- **Idempotent ingestion.** Every `UsageEvent` is uniquely keyed on `(collectorId, sourceEventId)`
  at the database level (`@@unique` in `prisma/schema.prisma`). Re-uploading the same batch (retry,
  collector restart, replayed history) is a no-op on the duplicates.
- **Incremental vs. cumulative.** `eventType` distinguishes a delta record from a cumulative
  snapshot. A connector that only exposes cumulative counters (e.g. a running session total) must
  diff against the last observed snapshot itself before emitting an `incremental` event, or emit
  `cumulative_snapshot` events and let the backend take the latest snapshot per `sourceEventId`
  rather than summing snapshots together. Mixing the two event types for the same source without
  this distinction is a bug, not a connector detail.
- **No cross-source addition for the same requests.** If both a tool-level and a provider-level
  integration could report the same underlying API calls, only one may be enabled per user per
  provider at a time in the first release. This is a documented limitation, not solved generally.

## OTel receiver: cumulative vs. delta

`/api/otel/v1/metrics` (`src/lib/otel.ts`) ingests Claude Code's `claude_code.token.usage` OTLP
counter, which OpenTelemetry allows to be exported with either **cumulative** or **delta**
aggregation temporality — the payload itself declares which (`aggregationTemporality: 2` for
cumulative, `1` for delta), so the receiver doesn't guess:

- **Delta**: each exported data point already *is* an increment. It's stored as an `incremental`
  event keyed on `session.id` + `model` + the data point's own timestamp — structurally identical
  to a JSONL transcript line.
- **Cumulative**: each exported data point is a running total since the counter started. Storage
  keys on `session.id` + `model` only (no timestamp), so every new export for that session+model
  **upserts** (overwrites) the same row with the latest total — summing the final snapshot per
  session gives the correct grand total without the receiver needing to diff against a previous
  value itself. A Claude Code process restart gets a new `session.id` from Claude Code itself, which
  is exactly the counter-reset boundary — the old session's last-known total is preserved as its
  own finalized row rather than being overwritten by a counter that restarted from zero.

Four `type` attribute values (`input`, `output`, `cacheRead`, `cacheCreation`) arrive as separate
data points; the receiver merges them into the same bucket set as everywhere else in this system
before persisting one row per (session, model, project[, timestamp]).

Every distinct attribute combination is its own OTLP time series (e.g. `query_source` =
`main`/`subagent`/`auxiliary`, fast mode, effort level). All of them are real token usage, so
series that share a row's identity are **summed**, never overwritten. `session.id` and `vcs.*` are
read from the data point's attributes first (where Claude Code puts them), the resource second. With
no `session.id` at all, a cumulative series' own start time is used as the reset epoch instead.

Values that aren't finite, are negative, or exceed the 32-bit column range are skipped (and
counted in the collector's "last upload" note) rather than stored or allowed to fail the write.

**Verification status (be honest about it):** the transport, header format and authentication were
verified with a genuine Claude Code 2.1.284 process exporting `claude_code.session.count` and
`claude_code.active_time.total` to production. A real `claude_code.token.usage` export has **not**
been captured (it requires an authenticated API request, and the bundled binary used for that test
was not logged in), so the token-usage handling is verified against payloads built from Claude Code's
documented schema plus the attribute layout seen in the real metrics above — not against a live one.

## Project attribution and reconciliation

- Usage is attributed to a project only when a connector exposes a defensible session → project
  relationship (working directory, git root, or explicit workspace metadata). Otherwise it is
  stored with `projectId = null` and `attributionMethod = "unassigned"` and must render as
  **Unassigned** everywhere, never silently dropped or folded into another project.
- A user can manually assign unassigned usage to a project; this is stored as
  `attributionMethod = "user_assigned"` and labeled as user-supplied in the UI, distinct from
  connector-detected attribution.
- Renaming, hiding, or merging projects reassigns `UsageEvent.projectId` values; it never
  creates, deletes, or duplicates `UsageEvent` rows. The sum of a user's attributed usage plus
  their unassigned usage must always equal their total ingested usage — this is a property any
  project-management operation must preserve, and is worth a regression test before shipping
  changes to merge/hide/rename.
