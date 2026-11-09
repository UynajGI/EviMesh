/*
 * Shared configuration for the Docker-free local stack
 * (scripts/local-stack.mjs, scripts/local-stack-reset.mjs).
 *
 * Everything lives outside the repository under EVIMESH_ENV_ROOT
 * (default ~/.cache/evimesh-env):
 *   local/   gotrue.exe, postgrest.exe, keys.json, src/auth/migrations
 *   pg16/    PostgreSQL 16 binaries (Library/bin)
 *   pgdata/  the cluster data directory
 * Every credential in keys.json is generated locally and is meaningless
 * outside this machine.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const root = process.env.EVIMESH_ENV_ROOT ?? join(homedir(), '.cache', 'evimesh-env');
const home = join(root, 'local');
const ports = Object.freeze({ pg: 55432, auth: 9999, rest: 54330, gateway: 54321, smtp: 54325, api: 8787, web: 3000 });
const gateway = `http://127.0.0.1:${ports.gateway}`;
const webOrigin = `http://localhost:${ports.web}`;

function keys() {
  return JSON.parse(readFileSync(join(home, 'keys.json'), 'utf8'));
}

export const LOCAL = Object.freeze({
  root,
  home,
  pgBin: join(root, 'pg16', 'Library', 'bin'),
  pgData: join(root, 'pgdata'),
  pgPort: ports.pg,
  db: 'evimesh_local',
  ports,
  gateway,
  webOrigin,
  keys,
  authEnv() {
    const k = keys();
    return {
      GOTRUE_DB_DRIVER: 'postgres',
      DATABASE_URL: `postgres://supabase_auth_admin@127.0.0.1:${ports.pg}/evimesh_local?sslmode=disable&search_path=auth`,
      GOTRUE_DB_MIGRATIONS_PATH: join(home, 'src', 'auth', 'migrations'),
      GOTRUE_API_HOST: '127.0.0.1',
      PORT: String(ports.auth),
      API_EXTERNAL_URL: `${gateway}/auth/v1`,
      GOTRUE_SITE_URL: webOrigin,
      GOTRUE_URI_ALLOW_LIST: `${webOrigin}/**,http://127.0.0.1:${ports.web}/**`,
      GOTRUE_JWT_SECRET: k.secret,
      GOTRUE_JWT_EXP: '3600',
      GOTRUE_JWT_AUD: 'authenticated',
      // Without a default group GoTrue mints role:"" and PostgREST rejects
      // every user request with `role "" does not exist`.
      GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated',
      GOTRUE_JWT_ADMIN_ROLES: 'service_role',
      GOTRUE_JWT_ISSUER: `${gateway}/auth/v1`,
      GOTRUE_JWT_KEYS: JSON.stringify([k.priv, k.oct]),
      GOTRUE_DISABLE_SIGNUP: 'false',
      GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true',
      GOTRUE_MAILER_AUTOCONFIRM: 'false',
      GOTRUE_SMTP_HOST: '127.0.0.1',
      GOTRUE_SMTP_PORT: String(ports.smtp),
      GOTRUE_SMTP_ADMIN_EMAIL: 'noreply@evimesh.local',
      GOTRUE_SMTP_SENDER_NAME: 'EviMesh local',
      GOTRUE_MAILER_URLPATHS_CONFIRMATION: '/auth/v1/verify',
      GOTRUE_MAILER_URLPATHS_INVITE: '/auth/v1/verify',
      GOTRUE_MAILER_URLPATHS_RECOVERY: '/auth/v1/verify',
      GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE: '/auth/v1/verify',
      GOTRUE_RATE_LIMIT_EMAIL_SENT: '1000',
      GOTRUE_SMTP_MAX_FREQUENCY: '1s',
      GOTRUE_LOG_LEVEL: 'warn',
      PGGSSENCMODE: 'disable',
    };
  },
});
