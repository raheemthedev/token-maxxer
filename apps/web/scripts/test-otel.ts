/**
 * Unit tests for the OTLP parser (`npm run test:otel`). Payloads are synthetic but mirror the
 * shapes documented for Claude Code: session.id / vcs.* as *data point* attributes, several series
 * per (session, model) differing only in query_source, cumulative and delta temporality.
 */
import { parseOtlpMetrics } from "../src/lib/otel";

let failures = 0;
function check(cond: boolean, label: string) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ FAIL: ${label}`);
    failures += 1;
  }
}

const salt = "test-salt";
const s = (v: string) => ({ stringValue: v });

function point(
  attrs: Record<string, string>,
  value: string | number,
  opts: { time?: string; start?: string; double?: boolean } = {},
) {
  return {
    attributes: Object.entries(attrs).map(([key, v]) => ({ key, value: s(v) })),
    startTimeUnixNano: opts.start ?? "1790000000000000000",
    timeUnixNano: opts.time ?? "1790000060000000000",
    ...(opts.double ? { asDouble: Number(value) } : { asInt: String(value) }),
  };
}

function payload(temporality: 1 | 2, dataPoints: unknown[], resourceAttrs: Record<string, string> = {}) {
  return {
    resourceMetrics: [
      {
        resource: { attributes: Object.entries(resourceAttrs).map(([key, v]) => ({ key, value: s(v) })) },
        scopeMetrics: [
          {
            metrics: [
              {
                name: "claude_code.token.usage",
                sum: { aggregationTemporality: temporality, isMonotonic: true, dataPoints },
              },
            ],
          },
        ],
      },
    ],
  };
}

const base = { model: "claude-sonnet-5", "session.id": "sess-1", "vcs.owner.name": "acme", "vcs.repository.name": "app" };

console.log("1. session.id and vcs.* as DATA POINT attributes (the documented Claude Code shape)");
{
  const { events } = parseOtlpMetrics(
    payload(2, [
      point({ ...base, type: "input" }, 100),
      point({ ...base, type: "output" }, 50),
      point({ ...base, type: "cacheRead" }, 400),
      point({ ...base, type: "cacheCreation" }, 30),
    ]),
    salt,
  );
  check(events.length === 1, "one merged row from four type series");
  check(events[0]?.tokens.input === 100 && events[0]?.tokens.output === 50, "input/output buckets");
  check(events[0]?.tokens.cacheRead === 400 && events[0]?.tokens.cacheWrite === 30, "cache buckets (cacheCreation → cacheWrite)");
  check(events[0]?.projectFingerprintHash !== null, "project attributed from data-point vcs attrs");
  check(events[0]?.projectHintRedacted === "acme/app", "project hint");
}

console.log("2. session.id / vcs.* as RESOURCE attributes still work");
{
  const { events } = parseOtlpMetrics(
    payload(2, [point({ model: "m", type: "input" }, 7)], { "session.id": "sess-r", "vcs.owner.name": "o", "vcs.repository.name": "r" }),
    salt,
  );
  check(events.length === 1 && events[0].sourceEventId.includes("sess-r"), "resource-level session id used");
  check(events[0]?.projectFingerprintHash !== null, "resource-level vcs attrs used");
}

console.log("3. multiple series per (session, model) differing only in query_source are SUMMED, not overwritten");
{
  const { events } = parseOtlpMetrics(
    payload(2, [
      point({ ...base, type: "input", query_source: "main" }, 1000),
      point({ ...base, type: "input", query_source: "subagent" }, 200),
      point({ ...base, type: "input", query_source: "auxiliary" }, 5),
      point({ ...base, type: "output", query_source: "main" }, 300),
      point({ ...base, type: "output", query_source: "subagent" }, 40),
    ]),
    salt,
  );
  check(events.length === 1, "still one row");
  check(events[0]?.tokens.input === 1205, "input = 1000 + 200 + 5 (was last-write-wins before the fix)");
  check(events[0]?.tokens.output === 340, "output = 300 + 40");
}

console.log("4. cumulative: later export for same session+model reuses the same sourceEventId (upsert)");
{
  const a = parseOtlpMetrics(payload(2, [point({ ...base, type: "input" }, 100)]), salt).events[0];
  const b = parseOtlpMetrics(payload(2, [point({ ...base, type: "input" }, 250, { time: "1790000120000000000" })]), salt).events[0];
  check(a.sourceEventId === b.sourceEventId, "same id across exports");
  check(b.tokens.input === 250, "latest cumulative value wins (not 350)");
}

console.log("5. new session → new row (previous session's total is preserved, not overwritten)");
{
  const a = parseOtlpMetrics(payload(2, [point({ ...base, type: "input" }, 100)]), salt).events[0];
  const b = parseOtlpMetrics(payload(2, [point({ ...base, "session.id": "sess-2", type: "input" }, 5)]), salt).events[0];
  check(a.sourceEventId !== b.sourceEventId, "different session → different row");
}

console.log("6. no session.id anywhere: fall back to the series start time as the epoch");
{
  const noSession = { model: "m", type: "input" };
  const a = parseOtlpMetrics(payload(2, [point(noSession, 10, { start: "111" })]), salt).events;
  const b = parseOtlpMetrics(payload(2, [point(noSession, 25, { start: "111", time: "222" })]), salt).events;
  const c = parseOtlpMetrics(payload(2, [point(noSession, 3, { start: "999" })]), salt).events;
  check(a.length === 1 && a[0].sourceEventId === b[0].sourceEventId, "same start time → same row across exports");
  check(a[0].sourceEventId !== c[0].sourceEventId, "different start time (process restart) → new row");
  check(a[0].projectFingerprintHash === null, "no vcs attrs → unassigned, not guessed");
}

console.log("7. delta temporality: one incremental row per timestamp, series summed within it");
{
  const { events } = parseOtlpMetrics(
    payload(1, [
      point({ ...base, type: "input", query_source: "main" }, 10, { time: "100" }),
      point({ ...base, type: "input", query_source: "subagent" }, 4, { time: "100" }),
      point({ ...base, type: "input", query_source: "main" }, 20, { time: "200" }),
    ]),
    salt,
  );
  check(events.length === 2, "two timestamps → two rows");
  check(events.every((e) => e.eventType === "incremental"), "marked incremental");
  check(events.find((e) => e.tokens.input === 14) !== undefined, "same-timestamp series summed (10 + 4)");
}

console.log("8. invalid values are skipped and reported, never stored or thrown");
{
  const r = parseOtlpMetrics(
    payload(2, [
      point({ ...base, type: "input" }, "not-a-number"),
      point({ ...base, type: "output" }, -5),
      point({ ...base, type: "cacheRead" }, 3_000_000_000),
      point({ ...base, type: "mystery" }, 1),
      point({ ...base, type: "cacheCreation" }, 12),
    ]),
    salt,
  );
  check(r.events.length === 1, "only the valid point produced a row");
  check(r.events[0]?.tokens.cacheWrite === 12 && r.events[0]?.tokens.input === null, "valid kept, invalid left as unknown (null), not zero");
  check(r.summary.includes("skipped"), "summary mentions what was skipped");
}

console.log("9. fractional (asDouble) values round to whole tokens");
{
  const e = parseOtlpMetrics(payload(2, [point({ ...base, type: "input" }, 41.6, { double: true })]), salt).events[0];
  check(e?.tokens.input === 42, "41.6 → 42");
}

console.log("10. junk payloads never throw");
for (const junk of [null, undefined, 42, "x", [], {}, { resourceMetrics: "no" }, { resourceMetrics: [null, 5, {}] }]) {
  let threw = false;
  let events = -1;
  try {
    events = parseOtlpMetrics(junk, salt).events.length;
  } catch {
    threw = true;
  }
  check(!threw && events === 0, `junk ${JSON.stringify(junk)} → 0 events, no throw`);
}

console.log("11. other metrics in the same export are ignored but reported in the summary");
{
  const p = payload(2, [point({ ...base, type: "input" }, 1)]);
  (p.resourceMetrics[0].scopeMetrics[0].metrics as unknown[]).push({
    name: "claude_code.session.count",
    sum: { aggregationTemporality: 2, dataPoints: [point({ "session.id": "sess-1" }, 1)] },
  });
  const r = parseOtlpMetrics(p, salt);
  check(r.events.length === 1, "only token usage becomes events");
  check(r.summary.includes("claude_code.session.count"), "summary lists the other metric (useful for debugging setup)");
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
