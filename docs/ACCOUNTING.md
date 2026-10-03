# Token accounting

## Buckets and headline total

Each event stores mutually exclusive `input`, `output`, `cacheRead`, `cacheWrite` and `reasoning` buckets. Null means unavailable; it is not a reported zero. The common formula is:

```
input + output + cacheRead + cacheWrite + (reasoningIncludedInOutput ? 0 : reasoning)
```

Missing categories contribute nothing to this display total and are flagged as incomplete. Claude reports exclusive input/output/cache counts, with reasoning included in output. Codex input includes cached input, so cached input is subtracted from fresh input; output includes reasoning. OpenCode already normalizes output to exclude reasoning, which is then included separately. Model volume is not normalized into a productivity score.

## Periods

Daily periods begin at 00:00 UTC; weeks begin Monday 00:00 UTC. Incremental request events belong to their recorded timestamp. Codex logs are replayed locally: changed counters use the explicit latest-response usage when available, because cumulative totals can rewind or jump as history is restored. Older logs without response usage fall back to positive cumulative differences; an unexplained rewind adds nothing. Repeated readings and overlapping retained pages add nothing. Disjoint pages of the same thread combine into deterministic daily/model/project partitions. Updating a partition only updates that partition, never an entire session's previous days.

Telemetry is timed at its export observation. The generated settings explicitly request delta temporality, with one-minute exports. A delta interval crossing midnight is attributed to the export time; a numeric metric cannot expose the exact request timestamps inside its interval.

For cumulative telemetry, `UsageCounter` holds the latest checkpoint. Within one account-serialized transaction, ingestion computes the difference and stores a separately dated incremental usage row. Duplicate or delayed exports are ignored; resets add the newly reset counter reading. Missing buckets preserve their checkpoint rather than being overwritten with zero. A first cumulative reading whose start is not known to be in the same day becomes an all-time-only baseline. It must not be fabricated as today's usage.

Old cumulative records without recoverable period bounds also remain all-time-only. Codex's next complete scan replaces its legacy session-total rows with dated partitions. Existing telemetry rows remain an all-time baseline when their checkpoint is first upgraded. Neither migration moves lifetime history into the day of an upload.

The collector checks `/api/health` for accounting version 2 before uploading. An older server cannot safely combine dated Codex partitions with legacy totals; uploads remain queued until the server is upgraded.

## Idempotency and canonical sources

Source event identity is scoped to the account and source. An account-level PostgreSQL advisory lock serializes ingestion, so retries and simultaneous collectors cannot create duplicate rows for the same event. The old collector/event database uniqueness constraint remains an additional safeguard. In-batch duplicates are collapsed; smaller or stale streaming readings never reduce a fuller saved reading. New history is bulk inserted, avoiding thousands of network round trips.

Claude transcript and telemetry paths are alternatives. Ingestion preserves the method already used by an account. For legacy accounts that enabled both, transcript collection is canonical; views exclude overlapping telemetry evidence without deleting it. The collector reports skipped source coverage. This is a consistency rule, not provider verification or a claim that every pair of different source records can be reconciled.

## Privacy, attribution and validation

Only an explicit metadata allowlist crosses the wire. Prompt/content fields, full paths, raw logs and credentials are excluded. Project fingerprints are salted hashes; published accounts show redacted project basenames or owner-edited names. Private projects have no public links or descriptions; hidden projects are omitted. Public projects can use owner-added links or anonymously verified public GitHub repository URLs. Merges redirect future ingestion while preserving the aggregate sum.

The API rejects negative/fractional/overflowing counts, invalid or future timestamps, malformed periods and full-path project hints. It always stores evidence as `locally_reported` regardless of the client's claim. Revocation and ownership are checked again inside the ingestion transaction.

Regression tests cover period boundaries, model switches, counter resets, retries, concurrent collectors, legacy replacement, canonical methods, malformed metadata, privacy filtering and offline queue recovery against real isolated PostgreSQL.
