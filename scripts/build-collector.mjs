import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const dist = `${root}packages/collector/dist`;
const publicDir = `${root}apps/web/public`;
await mkdir(dist, { recursive: true });
await build({ entryPoints: [`${root}packages/collector/src/cli.ts`], outfile: `${dist}/collector.cjs`, bundle: true,
  platform: 'node', target: 'node20', format: 'cjs', sourcemap: false });
const bytes = await readFile(`${dist}/collector.cjs`);
await writeFile(`${publicDir}/collector.cjs`, bytes);
await writeFile(`${publicDir}/collector.cjs.sha256`, createHash('sha256').update(bytes).digest('hex') + '\n');
console.log('Built standalone collector and verified-download artifacts.');
