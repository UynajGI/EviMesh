import test from 'node:test';
import assert from 'node:assert/strict';
import { FALLBACK_PUBLIC_CAPABILITIES, fetchPublicCapabilities, normalizePublicCapabilities } from '../lib/public-capabilities.js';

test('falls back closed when the capability document is absent or malformed', () => {
  assert.equal(normalizePublicCapabilities(null), FALLBACK_PUBLIC_CAPABILITIES);
  assert.equal(normalizePublicCapabilities({ schemaVersion: 'unknown' }), FALLBACK_PUBLIC_CAPABILITIES);
  assert.equal(normalizePublicCapabilities({
    schemaVersion: 'public-capabilities.v1',
    releaseChannel: 'preview',
    graphSchemaVersion: 'research-neighborhood.v1',
    deviceAuthorization: { enabled: true },
    research: { read: true, prepare: true, submit: true, signing: 'agent' },
    clients: {},
  }), FALLBACK_PUBLIC_CAPABILITIES);
});

test('accepts the complete capability contract', () => {
  const value = {
    schemaVersion: 'public-capabilities.v1',
    releaseChannel: 'beta',
    apiVersion: '0.3.0',
    graphSchemaVersion: 'research-neighborhood.v1',
    deviceAuthorization: { enabled: true },
    research: { read: true, prepare: true, submit: true, signing: 'human-local-only' },
    clients: {
      sdk: { available: true, minimumVersion: '1.0.0-rc.1' },
      cli: { available: true, minimumVersion: '1.0.0-rc.1' },
      mcp: { available: true, minimumVersion: '1.0.0-rc.1' },
    },
  };
  const normalized = normalizePublicCapabilities(value);
  assert.notEqual(normalized, value);
  assert.deepEqual(normalized, value);
  assert.equal(Object.isFrozen(normalized), true);
  assert.equal(Object.isFrozen(normalized.research), true);
});

test('fails closed when required version or read invariants are malformed', () => {
  const valid = {
    schemaVersion: 'public-capabilities.v1', releaseChannel: 'preview', apiVersion: '0.3.0',
    graphSchemaVersion: 'research-neighborhood.v1', deviceAuthorization: { enabled: true },
    research: { read: true, prepare: true, submit: true, signing: 'human-local-only' },
    clients: {
      sdk: { available: true, minimumVersion: '1.0.0-rc.1' },
      cli: { available: true, minimumVersion: '1.0.0-rc.1' },
      mcp: { available: true, minimumVersion: '1.0.0-rc.1' },
    },
  };
  assert.equal(normalizePublicCapabilities({ ...valid, apiVersion: null }), FALLBACK_PUBLIC_CAPABILITIES);
  assert.equal(normalizePublicCapabilities({ ...valid, research: { ...valid.research, read: false } }), FALLBACK_PUBLIC_CAPABILITIES);
  assert.equal(normalizePublicCapabilities({ ...valid, clients: { ...valid.clients, cli: { available: true, minimumVersion: 'latest' } } }), FALLBACK_PUBLIC_CAPABILITIES);
});

test('network and server failures remain a read-only public preview', async () => {
  assert.equal(await fetchPublicCapabilities({ apiUrl: null }), FALLBACK_PUBLIC_CAPABILITIES);
  assert.equal(await fetchPublicCapabilities({ apiUrl: 'https://api.example.test', fetchImpl: async () => new Response('', { status: 503 }) }), FALLBACK_PUBLIC_CAPABILITIES);
  assert.equal(await fetchPublicCapabilities({ apiUrl: 'https://api.example.test', fetchImpl: async () => { throw new Error('offline'); } }), FALLBACK_PUBLIC_CAPABILITIES);
});
