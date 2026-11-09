/*
 * Full local EviMesh backend without Docker.
 *
 *   PostgreSQL 16 (existing local cluster)      127.0.0.1:55432  db evimesh_local
 *   Supabase Auth (gotrue, built from source)   127.0.0.1:9999   (internal)
 *   PostgREST                                   127.0.0.1:54330  (internal)
 *   Supabase-shaped gateway                     127.0.0.1:54321  /auth/v1, /rest/v1, /_mail
 *   SMTP sink (sign-in links, confirmations)    127.0.0.1:54325
 *   api-edge Worker (real Hono app, Node host)  127.0.0.1:8787
 *
 * Paths, ports and generated keys come from scripts/local-stack-config.mjs.
 * Rebuild the database with: node scripts/local-stack-reset.mjs
 *
 * Usage:
 *   node scripts/local-stack.mjs            # start everything, Ctrl+C stops
 *   node scripts/local-stack.mjs --env      # print the Web env for apps/web
 *
 * Never point this at hosted infrastructure. Every credential it uses is
 * generated locally and is meaningless outside this machine.
 */
import { spawn } from 'node:child_process';
import { createServer, request as httpRequest } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { existsSync } from 'node:fs';
import { createPublicKey } from 'node:crypto';
import { join } from 'node:path';
import { createWorker } from '../apps/api-edge/src/index.mjs';
import { LOCAL } from './local-stack-config.mjs';

const HOME = LOCAL.home;
const PG_BIN = LOCAL.pgBin;
const PG_DATA = LOCAL.pgData;
const PG_PORT = LOCAL.ports.pg;
const DB = LOCAL.db;
const AUTH_PORT = LOCAL.ports.auth;
const REST_PORT = LOCAL.ports.rest;
const GATEWAY_PORT = LOCAL.ports.gateway;
const SMTP_PORT = LOCAL.ports.smtp;
const API_PORT = LOCAL.ports.api;
const WEB_ORIGIN = LOCAL.webOrigin;
const GATEWAY = LOCAL.gateway;

const keys = LOCAL.keys();

export const webEnv = {
  NEXT_PUBLIC_EVIMESH_API_URL: `http://127.0.0.1:${API_PORT}`,
  NEXT_PUBLIC_SUPABASE_URL: GATEWAY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: keys.anon,
};

if (process.argv.includes('--env')) {
  for (const [name, value] of Object.entries(webEnv)) console.log(`${name}=${value}`);
  process.exit(0);
}

const children = [];
function run(name, command, args, env = {}) {
  const child = spawn(command, args, {
    env: { ...process.env, PATH: `${PG_BIN};${process.env.PATH}`, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const prefix = (chunk) => chunk.toString().split(/\r?\n/).filter(Boolean).forEach((line) => console.log(`[${name}] ${line}`));
  child.stdout.on('data', prefix);
  child.stderr.on('data', prefix);
  child.on('exit', (code) => console.log(`[${name}] exited ${code}`));
  children.push(child);
  return child;
}

function stopAll() {
  for (const child of children) child.kill();
  process.exit(0);
}
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);

/* ------------------------------------------------------------ postgres -- */
async function pgReady() {
  return new Promise((resolve) => {
    const probe = spawn(join(PG_BIN, 'pg_isready.exe'), ['-h', '127.0.0.1', '-p', String(PG_PORT)], { windowsHide: true });
    probe.on('exit', (code) => resolve(code === 0));
    probe.on('error', () => resolve(false));
  });
}
if (!await pgReady()) {
  console.log('[postgres] starting cluster in', PG_DATA);
  // Detached: the database outlives this script; stop it with pg_ctl stop.
  spawn(join(PG_BIN, 'pg_ctl.exe'), ['-D', PG_DATA, '-o', `-p ${PG_PORT}`, '-l', join(PG_DATA, 'server.log'), 'start'], { stdio: 'ignore', detached: true, windowsHide: true }).unref();
  for (let i = 0; i < 30 && !await pgReady(); i += 1) await new Promise((r) => setTimeout(r, 500));
}
console.log('[postgres] ready on', PG_PORT);

/* ---------------------------------------------------------------- auth -- */
const authEnv = LOCAL.authEnv();

/* ---------------------------------------------------------- smtp sink -- */
const inbox = [];
function decodeMessage(raw) {
  const [head, ...rest] = raw.split(/\r?\n\r?\n/);
  let body = rest.join('\n\n');
  const header = (name) => (new RegExp(`^${name}:\\s*(.*)$`, 'im').exec(head) ?? [])[1] ?? '';
  if (/quoted-printable/i.test(head)) {
    body = body.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  } else if (/base64/i.test(header('Content-Transfer-Encoding'))) {
    body = Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
  }
  const links = [...new Set([...body.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((match) => match[0].replace(/&amp;/g, '&')))];
  return { to: header('To'), subject: header('Subject'), receivedAt: new Date().toISOString(), links, body };
}
createTcpServer((socket) => {
  let buffer = '';
  let inData = false;
  socket.write('220 evimesh-local smtp\r\n');
  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    for (;;) {
      if (inData) {
        const end = buffer.indexOf('\r\n.\r\n');
        if (end < 0) return;
        const message = decodeMessage(buffer.slice(0, end));
        inbox.unshift(message);
        console.log(`[mail] to ${message.to}: ${message.subject}`);
        buffer = buffer.slice(end + 5);
        inData = false;
        socket.write('250 queued\r\n');
        continue;
      }
      const lineEnd = buffer.indexOf('\r\n');
      if (lineEnd < 0) return;
      const line = buffer.slice(0, lineEnd);
      buffer = buffer.slice(lineEnd + 2);
      const verb = line.slice(0, 4).toUpperCase();
      if (verb === 'EHLO' || verb === 'HELO') socket.write('250-evimesh-local\r\n250 OK\r\n');
      else if (verb === 'DATA') { inData = true; socket.write('354 end with .\r\n'); }
      else if (verb === 'QUIT') { socket.end('221 bye\r\n'); return; }
      else socket.write('250 OK\r\n');
    }
  });
  socket.on('error', () => {});
}).listen(SMTP_PORT, '127.0.0.1');

run('auth', join(HOME, 'gotrue.exe'), ['serve'], authEnv);

/* ----------------------------------------------------------- postgrest -- */
run('rest', join(HOME, 'postgrest.exe'), [], {
  PGRST_DB_URI: `postgres://authenticator@127.0.0.1:${PG_PORT}/${DB}`,
  PGRST_DB_SCHEMAS: 'public',
  PGRST_DB_ANON_ROLE: 'anon',
  PGRST_DB_EXTRA_SEARCH_PATH: 'public, extensions',
  PGRST_JWT_SECRET: JSON.stringify({ keys: [keys.pub, keys.oct] }),
  PGRST_SERVER_HOST: '127.0.0.1',
  PGRST_SERVER_PORT: String(REST_PORT),
  PGRST_DB_CHANNEL_ENABLED: 'true',
  PGRST_LOG_LEVEL: 'warn',
  // Local trust auth; skip the Kerberos probe (it spawns a lingering ccapiserver).
  PGGSSENCMODE: 'disable',
});

/* ------------------------------------------------------------- gateway -- */
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, prefer, range, accept-profile, content-profile, x-supabase-api-version',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-expose-headers': 'content-range, x-total-count',
};
function proxy(req, res, port, path) {
  const headers = { ...req.headers, host: `127.0.0.1:${port}` };
  // Like Kong: an apikey without an explicit bearer becomes the bearer.
  if (!headers.authorization && headers.apikey) headers.authorization = `Bearer ${headers.apikey}`;
  const upstream = httpRequest({ host: '127.0.0.1', port, method: req.method, path, headers }, (response) => {
    res.writeHead(response.statusCode ?? 502, { ...response.headers, ...CORS });
    response.pipe(res);
  });
  upstream.on('error', (error) => {
    res.writeHead(502, { 'content-type': 'application/json', ...CORS });
    res.end(JSON.stringify({ message: `local upstream unavailable: ${error.message}` }));
  });
  req.pipe(upstream);
}
createServer((req, res) => {
  const url = req.url ?? '/';
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
  if (url.startsWith('/auth/v1/')) return proxy(req, res, AUTH_PORT, url.slice('/auth/v1'.length));
  if (url.startsWith('/rest/v1/')) return proxy(req, res, REST_PORT, url.slice('/rest/v1'.length));
  if (url === '/_mail.json') { res.writeHead(200, { 'content-type': 'application/json', ...CORS }); res.end(JSON.stringify(inbox)); return; }
  if (url === '/_mail' || url === '/_mail/') {
    const rows = inbox.map((message) => `<li><b>${message.subject}</b> to ${message.to} <small>${message.receivedAt}</small><ul>${message.links.map((link) => `<li><a href="${link}">${link}</a></li>`).join('')}</ul></li>`).join('');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><title>Local inbox</title><h1>Local inbox</h1><ol>${rows || '<li>No mail yet</li>'}</ol>`);
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json', ...CORS });
  res.end('{"message":"not found"}');
}).listen(GATEWAY_PORT, '127.0.0.1', () => console.log(`[gateway] ${GATEWAY}  (inbox: ${GATEWAY}/_mail)`));

/* ------------------------------------------------------------ api-edge -- */
// The keyring carries the canonical SPKI public key; derive it from the
// PKCS#8 secret so a raw-x public key in keys.json can never drift from it.
const platformPublicKey = createPublicKey({ key: Buffer.from(keys.platform.privateKey, 'base64url'), format: 'der', type: 'pkcs8' })
  .export({ format: 'der', type: 'spki' }).toString('base64url');
export const apiEnv = {
  EVIMESH_ENV: 'development',
  EVIMESH_RELEASE_CHANNEL: 'preview',
  EVIMESH_WEB_URL: WEB_ORIGIN,
  CORS_ALLOWED_ORIGINS: `${WEB_ORIGIN},http://127.0.0.1:3000`,
  SUPABASE_URL: GATEWAY,
  SUPABASE_PUBLISHABLE_KEY: keys.anon,
  SUPABASE_SERVICE_ROLE_KEY: keys.service,
  SUPABASE_JWKS: JSON.stringify({ keys: [keys.pub] }),
  SUPABASE_JWT_ISSUER: `${GATEWAY}/auth/v1`,
  EVIMESH_DEVICE_AUTH_ENABLED: 'true',
  EVIMESH_RESEARCH_PREPARE_ENABLED: 'true',
  EVIMESH_RESEARCH_SUBMIT_ENABLED: 'true',
  EVIMESH_TYPED_RESEARCH_ATOMIC_RPC_READY: 'true',
  RESEARCH_GRAPH_READ_MODE: process.env.RESEARCH_GRAPH_READ_MODE ?? 'kernel',
  RESEARCH_GRAPH_WRITE_MODE: 'kernel',
  RESEARCH_GRAPH_CUTOVER_READY: 'true',
  PLATFORM_KEYRING: JSON.stringify({ activeKey: { keyId: keys.platform.keyId, publicKey: platformPublicKey } }),
  PLATFORM_EVENT_SIGNING_PRIVATE_KEY: keys.platform.privateKey,
  PLATFORM_EVENT_SIGNING_KEY_ID: keys.platform.keyId,
  ACTOR_RATE_LIMIT_MAX: '600',
  API_TOKEN_RATE_LIMIT_MAX: '600',
  RATE_LIMIT_WINDOW_SECONDS: '60',
};
const worker = createWorker();
createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const request = new Request(new URL(req.url ?? '/', `http://127.0.0.1:${API_PORT}`), {
    method: req.method,
    headers: req.headers,
    body: ['GET', 'HEAD'].includes(req.method ?? '') ? undefined : Buffer.concat(chunks),
  });
  try {
    const response = await worker.fetch(request, apiEnv, { waitUntil() {}, passThroughOnException() {} });
    const headers = {};
    for (const [name, value] of response.headers) {
      if (!['content-length', 'transfer-encoding', 'connection', 'content-encoding'].includes(name.toLowerCase())) headers[name] = value;
    }
    res.writeHead(response.status, headers);
    res.end(Buffer.from(await response.arrayBuffer()));
    if (response.status >= 500) console.log(`[api] ${req.method} ${req.url} -> ${response.status}`);
  } catch (error) {
    console.log(`[api] ${req.method} ${req.url} threw`, error);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ code: 'local_stack_error', message: String(error?.message ?? error) }));
  }
}).listen(API_PORT, '127.0.0.1', () => console.log(`[api] http://127.0.0.1:${API_PORT}`));

if (!existsSync(join(HOME, 'gotrue.exe'))) console.log('[auth] gotrue.exe missing in', HOME);
