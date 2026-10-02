import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import nextEnv from '@next/env';
const root = fileURLToPath(new URL('../', import.meta.url));
const web = `${root}apps/web`;
nextEnv.loadEnvConfig(web, true);
const run = (cmd, args, env = process.env) => new Promise((resolve, reject) => {
  const child = spawn(cmd === 'npm' ? process.execPath : cmd, cmd === 'npm' ? [process.env.npm_execpath, ...args] : args, { cwd: root, env, stdio: 'inherit' });
  child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)));
});
let database;
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('127.0.0.1:55432/token_maxxer')) {
  const dir = `${root}.local/postgres`;
  await mkdir(`${root}.local`, { recursive: true, mode: 0o700 });
  const secretsPath = `${root}.local/secrets.json`;
  let secrets;
  try { secrets = JSON.parse(await readFile(secretsPath, 'utf8')); }
  catch { secrets = { password: randomBytes(24).toString('hex'), auth: randomBytes(32).toString('hex'), collector: randomBytes(32).toString('hex') }; await writeFile(secretsPath, JSON.stringify(secrets), { mode: 0o600 }); }
  database = new EmbeddedPostgres({ databaseDir: dir, port: 55432, user: 'postgres', password: secrets.password,
    persistent: true, postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
  if (!existsSync(`${dir}/PG_VERSION`)) await database.initialise();
  await database.start();
  const client = database.getPgClient(); await client.connect();
  const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = 'token_maxxer'"); await client.end();
  if (!existing.rowCount) await database.createDatabase('token_maxxer');
  process.env.DATABASE_URL = `postgresql://postgres:${secrets.password}@127.0.0.1:55432/token_maxxer`;
  process.env.AUTH_SECRET ||= secrets.auth; process.env.COLLECTOR_TOKEN_SECRET ||= secrets.collector; process.env.AUTH_TRUST_HOST = 'true';
  const path = `${web}/.env.local`;
  let content = existsSync(path) ? await readFile(path, 'utf8') : '';
  for (const name of ['DATABASE_URL', 'AUTH_SECRET', 'COLLECTOR_TOKEN_SECRET', 'AUTH_TRUST_HOST']) {
    content = content.replace(new RegExp(`^${name}=.*(?:\\r?\\n|$)`, 'gm'), '');
    content += `\n${name}=${JSON.stringify(process.env[name])}\n`;
  }
  await writeFile(path, content, { mode: 0o600 });
  console.log('Local PostgreSQL is ready. Your development data stays in .local/postgres.');
}
try {
  await run(process.execPath, [`${root}scripts/build-collector.mjs`]);
  await run('npm', ['run', 'db:push']);
  const child = spawn(process.execPath, [process.env.npm_execpath, 'run', 'dev', '--workspace', 'apps/web'], { cwd: root, env: process.env, stdio: 'inherit' });
  let stopping = false;
  const stop = async () => { if (stopping) return; stopping = true; child.kill('SIGTERM'); if (database) await database.stop(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  await new Promise(resolve => child.on('exit', resolve));
} finally { if (database) await database.stop(); }
