# Connector support

| Source | Interface | History and timing | Project attribution | Setup |
| --- | --- | --- | --- | --- |
| Claude Code | Local JSONL transcripts, streamed; assistant usage metadata only | Retained request history; streaming readings deduplicated by request ID | Working directory → Git root → folder fallback | Recommended background collector |
| Codex | Active and archived local rollout JSONL, streamed; cumulative token counters | Retained counters replayed into daily/model/project partitions; thread ID distinguishes subagents | Working directory at each turn → Git root → folder | Same collector; respects `CODEX_HOME` |
| OpenCode | Documented local HTTP session/message API; temporary password-protected loopback server | Completed assistant message metadata with stable session/message IDs | Session directory → Git root → folder | Same collector; requires current OpenCode on PATH |
| Claude Code telemetry | OTLP HTTP/JSON numeric token metrics | New usage only; delta exports or differences between cumulative checkpoints | Repository attributes when available; otherwise unassigned | Optional Claude-only settings command |

The OpenCode implementation no longer invokes the nonexistent `stats --json` option and never queries its internal SQLite schema. Its metadata normalization was validated against an isolated OpenCode 1.18.30 import/export fixture. The local API collector lists all sessions with `roots=false` through the global history endpoint (including archived sessions and histories larger than its default page) so subagent sessions can be included; cross-project coverage is tested against isolated fixtures before claiming support for an installed version. Prompts and parts returned by the local API are discarded locally and never included in uploads. No provider request is made to collect usage.

Anthropic input/output/cache buckets are exclusive. Codex input includes cached input, so cached counts are subtracted from fresh input; reasoning stays folded into output. OpenCode's normalized output excludes its separate reasoning bucket, so that bucket is added once. Missing categories are null, not invented zeroes.

Compressed Codex `.jsonl.zst` rollouts are currently unsupported and explicitly reported in tool status; they are never fabricated as zero usage.

One canonical Claude collection method is counted per account. If an older account contains both transcript and telemetry records, transcript records are canonical and the overlapping telemetry evidence is retained but excluded. This cannot prove that unrelated source records represent identical requests; a deliberate change of collection method needs the user's data review.

The collector runs every five minutes, checkpoints successful records, retains a durable metadata-only outbox while offline, and reports tool errors separately. macOS launch-agent startup was tested end to end with a synthetic collector. Linux cron and Windows Task Scheduler definitions are implemented; native platform verification is required before broad rollout on those systems.

Not supported: ChatGPT/Claude consumer-app message counting, arbitrary editor/provider usage, provider verification, or usage whose tool exposes no reliable numeric interface. Unsupported sources never silently become zero usage.
