import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/index.mjs';
import { probePublicDependencies } from '../src/dependency-health.mjs';

const NOW = new Date('2026-08-31T12:00:00.000Z');

test('dependency health probes Auth, Database, and R2 without exposing payloads', async () => {
  const urls = [];
  const result = await probePublicDependencies({
    env: {
      SUPABASE_URL: 'https://project.supabase.co/',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      ARTIFACTS: { head: async (key) => { assert.equal(key, '__evimesh_public_health_probe__'); return null; } },
    },
    now: NOW,
    fetchImpl: async (url, init) => {
      urls.push(url);
      assert.equal(init.headers.apikey, 'sb_publishable_test');
      return new Response('{}', { status: 200 });
    },
  });
  assert.deepEqual(urls.sort(), [
    'https://project.supabase.co/auth/v1/health',
    'https://project.supabase.co/rest/v1/projects?select=project_id&limit=1',
  ]);
  assert.equal(result.status, 'operational');
  assert.equal(result.checkedAt, NOW.toISOString());
  assert.deepEqual(Object.keys(result.components), ['authentication', 'database', 'objectStorage']);
  assert.equal(JSON.stringify(result).includes('sb_publishable_test'), false);
});

test('dependency health fails closed and the route returns 503 when any component is unavailable', async () => {
  const app = createApp({
    dependencyProbe: async () => ({
      status: 'degraded',
      checkedAt: NOW.toISOString(),
      components: { authentication: { status: 'unavailable' } },
    }),
  });
  const response = await app.fetch(new Request('https://api.example.test/health/dependencies'), {});
  assert.equal(response.status, 503);
  assert.equal((await response.json()).status, 'degraded');
});
