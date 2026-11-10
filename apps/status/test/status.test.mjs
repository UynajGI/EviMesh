import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/worker.mjs';
import { collectPublicStatus, currentPublicStatus, persistPublicStatus, renderStatusPage } from '../src/status.mjs';
import { createDurableObjectStatusStore, StatusStateDurableObject } from '../src/state-do.mjs';

const NOW = new Date('2026-08-31T12:00:00.000Z');

function fetchFor({ web = 200, api = 200, dependencies = 200 } = {}) {
  return async (url) => {
    if (url === 'https://evimesh.com/') return new Response('<!doctype html>', { status: web, headers: { 'content-type': 'text/html' } });
    if (url === 'https://api.evimesh.com/health') return new Response(JSON.stringify({ status: 'ok' }), { status: api });
    if (url === 'https://api.evimesh.com/health/dependencies') return new Response(JSON.stringify({
      status: dependencies === 200 ? 'operational' : 'degraded',
      components: {
        authentication: { status: dependencies === 200 ? 'operational' : 'unavailable', latencyMs: 4 },
        database: { status: 'operational', latencyMs: 7 },
        objectStorage: { status: 'operational', latencyMs: 9 },
      },
    }), { status: dependencies });
    throw new Error(`unexpected URL ${url}`);
  };
}

function memoryKv() {
  const values = new Map();
  return {
    values,
    async get(key, type) {
      const value = values.get(key) ?? null;
      return type === 'json' && value ? JSON.parse(value) : value;
    },
    async put(key, value) { values.set(key, value); },
  };
}

test('collects live Web, API, Database, Object Storage, and Authentication status', async () => {
  const snapshot = await collectPublicStatus({ fetchImpl: fetchFor(), now: NOW });
  assert.equal(snapshot.status, 'operational');
  assert.equal(snapshot.checkedAt, NOW.toISOString());
  assert.deepEqual(Object.keys(snapshot.components), ['website', 'api', 'database', 'objectStorage', 'authentication']);
});

test('fails closed when a dependency reports disruption', async () => {
  const snapshot = await collectPublicStatus({ fetchImpl: fetchFor({ dependencies: 503 }), now: NOW });
  assert.equal(snapshot.status, 'degraded');
  assert.equal(snapshot.components.authentication.status, 'unavailable');
  assert.equal(snapshot.components.database.status, 'operational');
});

test('uses a fresh persisted snapshot without running probes', async () => {
  const kv = memoryKv();
  const snapshot = await collectPublicStatus({ fetchImpl: fetchFor(), now: NOW });
  await persistPublicStatus(kv, snapshot);
  const current = await currentPublicStatus({ env: { STATUS_STATE: kv }, fetchImpl: async () => { throw new Error('probe should not run'); }, now: new Date(NOW.valueOf() + 60_000) });
  assert.deepEqual(current, snapshot);
});

test('renders a script-free editorial status page with every public component', () => {
  const snapshot = {
    schemaVersion: 'public-status.v1', status: 'operational', checkedAt: NOW.toISOString(),
    components: Object.fromEntries(['website', 'api', 'database', 'objectStorage', 'authentication'].map((name) => [name, { status: 'operational', latencyMs: 1 }])),
  };
  const html = renderStatusPage(snapshot);
  for (const label of ['Web', 'API', 'Database', 'Object Storage', 'Authentication']) assert.match(html, new RegExp(`>${label}<`));
  assert.doesNotMatch(html, /<script/i);
  assert.match(html, /Evi<em>Mesh<\/em>/);
});

test('Worker status API is truthful and returns security headers', async () => {
  const kv = memoryKv();
  const snapshot = await collectPublicStatus({ fetchImpl: fetchFor(), now: new Date() });
  await persistPublicStatus(kv, snapshot);
  const response = await worker.fetch(new Request('https://status.evimesh.com/api/status'), { STATUS_STATE: kv }, { waitUntil() {} });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await response.json()).status, 'operational');
});

test('scheduled handler persists the probe result', async () => {
  const kv = memoryKv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchFor();
  try {
    let pending;
    await worker.scheduled({ cron: '*/5 * * * *' }, { STATUS_STATE: kv }, { waitUntil(value) { pending = value; } });
    await pending;
    assert.ok(kv.values.has('public-status:v1:latest'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Durable Object adapter stores status values without exposing its storage API', async () => {
  const values = new Map();
  const object = new StatusStateDurableObject({ storage: {
    async get(key) { return values.get(key); },
    async put(key, value) { values.set(key, value); },
  } });
  const namespace = { getByName(name) {
    assert.equal(name, 'public-status');
    return { fetch: (input, init) => object.fetch(new Request(input, init)) };
  } };
  const store = createDurableObjectStatusStore(namespace);
  await store.put('latest/status', '{"status":"operational"}');
  assert.deepEqual(await store.get('latest/status', 'json'), { status: 'operational' });
  assert.equal(await store.get('missing', 'json'), null);
});
