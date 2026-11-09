/*
 * Rebuild the disposable local EviMesh database from nothing.
 *
 *   node scripts/local-stack-reset.mjs
 *
 * Steps: (re)create database `evimesh_local` on the local cluster, install
 * the Supabase-shaped roles/schemas, run the Supabase Auth (gotrue) schema
 * migrations, then apply every Drizzle migration in journal order.
 *
 * Refuses to run against anything other than 127.0.0.1:55432. The stack
 * (node scripts/local-stack.mjs) should be stopped first; Postgres itself is
 * started here if it is not already running.
 */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from '../packages/database/node_modules/postgres/src/index.js';
import { LOCAL } from './local-stack-config.mjs';

const pgBin = (name) => join(LOCAL.pgBin, `${name}.exe`);

function pgReady() {
  return spawnSync(pgBin('pg_isready'), ['-h', '127.0.0.1', '-p', String(LOCAL.pgPort)], { windowsHide: true }).status === 0;
}
if (!pgReady()) {
  console.log('starting postgres in', LOCAL.pgData);
  spawn(pgBin('pg_ctl'), ['-D', LOCAL.pgData, '-o', `-p ${LOCAL.pgPort}`, '-l', join(LOCAL.pgData, 'server.log'), 'start'], { stdio: 'ignore', detached: true, windowsHide: true }).unref();
  for (let i = 0; i < 40 && !pgReady(); i += 1) await new Promise((resolve) => setTimeout(resolve, 500));
  if (!pgReady()) throw new Error('postgres did not start');
}

const admin = postgres(`postgres://postgres@127.0.0.1:${LOCAL.pgPort}/postgres`, { max: 1, onnotice: () => {} });
await admin.unsafe(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${LOCAL.db}' AND pid <> pg_backend_pid()`);
await admin.unsafe(`DROP DATABASE IF EXISTS ${LOCAL.db}`);
await admin.unsafe(`CREATE DATABASE ${LOCAL.db}`);
await admin.end();
console.log('database', LOCAL.db, 'recreated');

const db = postgres(`postgres://postgres@127.0.0.1:${LOCAL.pgPort}/${LOCAL.db}`, { max: 1, onnotice: () => {} });
await db.unsafe(`
DO $r$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticator') THEN CREATE ROLE authenticator LOGIN NOINHERIT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin LOGIN CREATEROLE; END IF;
END $r$;
GRANT anon, authenticated, service_role TO authenticator;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto SCHEMA extensions;
CREATE EXTENSION "uuid-ossp" SCHEMA extensions;
CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;
GRANT USAGE ON SCHEMA auth, extensions TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER ROLE supabase_auth_admin SET search_path = auth;
`);
console.log('roles and schemas installed');

const migrate = spawnSync(join(LOCAL.home, 'gotrue.exe'), ['migrate'], {
  env: { ...process.env, ...LOCAL.authEnv() },
  encoding: 'utf8',
  windowsHide: true,
});
if (migrate.status !== 0) {
  console.error(migrate.stdout, migrate.stderr);
  throw new Error('gotrue migrate failed');
}
await db.unsafe('GRANT SELECT ON auth.users TO service_role; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;');
console.log('auth schema migrated');

const root = new URL('../packages/database/drizzle/', import.meta.url);
const journal = JSON.parse(readFileSync(new URL('meta/_journal.json', root), 'utf8'));
for (const entry of journal.entries) {
  const parts = readFileSync(new URL(`${entry.tag}.sql`, root), 'utf8')
    .split('--> statement-breakpoint').map((part) => part.trim()).filter(Boolean);
  try {
    await db.begin(async (tx) => {
      await tx.unsafe('SET search_path = public, extensions');
      for (const part of parts) await tx.unsafe(part);
    });
  } catch (error) {
    console.error('FAIL', entry.tag, '-', error.message.split('\n')[0]);
    await db.end();
    process.exit(1);
  }
}
console.log(`applied ${journal.entries.length} migrations (last ${journal.entries.at(-1).tag})`);
await db.unsafe("NOTIFY pgrst, 'reload schema'");
await db.end();
