import EmbeddedPostgres from 'embedded-postgres';
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
const port = await new Promise(resolve => { const socket = createServer(); socket.listen(0, '127.0.0.1', () => { const port = socket.address().port; socket.close(() => resolve(port)); }); });
const dir = await mkdtemp(join(tmpdir(), 'tokenmaxxer-tests-'));
const password = randomBytes(16).toString('hex');
const db = new EmbeddedPostgres({ databaseDir: join(dir, 'postgres'), user: 'postgres', password, port,
  persistent: false, postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
const env = { ...process.env, DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:${port}/postgres`, NODE_ENV: 'test' };
const run = (cmd, args) => new Promise((resolve, reject) => {
  const child = spawn(cmd === 'npm' ? process.execPath : cmd, cmd === 'npm' ? [process.env.npm_execpath, ...args] : args, { env, stdio: 'inherit' });
  child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Tests exited ${code}`)));
});
try {
  await db.initialise(); await db.start();
  await run('npm', ['run', 'db:push']);
  const files = [];
  for (const directory of ['packages/collector/test', 'apps/web/test']) for (const file of await readdir(directory)) if (file.endsWith('.test.ts')) files.push(`${directory}/${file}`);
  await run(process.execPath, ['node_modules/tsx/dist/cli.mjs', '--tsconfig', 'apps/web/tsconfig.json', '--test', ...files]);
  await run('npm', ['run', 'test:otel', '--workspace', 'apps/web']);
} finally { await db.stop(); }
