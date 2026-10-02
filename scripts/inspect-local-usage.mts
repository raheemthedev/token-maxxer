import { readFileSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { connectors } from '../packages/collector/src/diagnostics';
import { dedupeEvents } from '../packages/collector/src/sync';
import { resetProjectCache } from '../packages/collector/src/project';
import { computeHeadlineTotal, type NormalizedUsageEvent } from '@token-maxxer/shared';

// Explicit owner-run inspection. This never uploads, changes pairing, enables telemetry,
// or retains message content. Only the existing paired collector's project salt is read.
const pairing = JSON.parse(readFileSync(join(homedir(), '.token-maxxer/config.json'), 'utf8'));
const directory = join(process.cwd(), '.local', 'real-usage');
mkdirSync(directory, { recursive: true, mode: 0o700 });
chmodSync(directory, 0o700);
resetProjectCache();
const statuses = [];
let collected: NormalizedUsageEvent[] = [];
for (const connector of connectors) {
  try {
    const status = await connector.detect();
    const events = status.status === 'ok' ? await connector.collect(pairing.projectSalt) : [];
    collected.push(...events);
    statuses.push({ source: connector.source, status: status.status, message: status.message, records: events.length });
  } catch { statuses.push({ source: connector.source, status: 'error', message: 'This tool could not be read.', records: 0 }); }
}
const events = dedupeEvents(collected);
const now = new Date();
const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const week = new Date(+day - ((day.getUTCDay()+6)%7)*86400000);
const summary = { collectedAt: now.toISOString(), weekStartUtc: week.toISOString(), records: events.length,
  tools: statuses.map(status => {
    const records = events.filter(e=>e.source===status.source);
    const sum = (from: Date) => records.filter(e=>new Date(e.observedAt)>=from && new Date(e.observedAt)<=now).reduce((sum,e)=>sum+computeHeadlineTotal(e.tokens),0);
    return { ...status, records: records.length, allTime: sum(new Date(0)), thisWeek: sum(week), today: sum(day) };
  }) };
writeFileSync(join(directory, 'events.json'), JSON.stringify(events), { mode: 0o600 });
writeFileSync(join(directory, 'summary.json'), JSON.stringify(summary,null,2), { mode: 0o600 });
console.log(JSON.stringify(summary,null,2));
