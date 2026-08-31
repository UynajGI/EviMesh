import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseNonceStore, SupabaseNonceStoreError } from '../src/supabase-nonce-store.mjs';

const MODERN_ENV = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_server-secret', SUPABASE_SERVICE_ROLE_KEY: 'legacy-secret' };
const LEGACY_ENV = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'legacy-service-role-jwt' };

test('uses a modern secret as apikey only for one private atomic nonce insert', async () => {
  let request;
  const store = createSupabaseNonceStore({
    env: MODERN_ENV,
    now: () => '2026-08-08T00:00:00.000Z',
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify([{ nonce: 'nonce-0123456789abcdef' }]), { status: 201, headers: { 'content-type': 'application/json' } });
    },
  });
  assert.equal(await store.claimSignatureNonce({ actorId: 'actor-1', keyId: 'key-1', nonce: 'nonce-0123456789abcdef' }), true);
  assert.equal(request.url, 'https://project.supabase.co/rest/v1/signature_nonces?on_conflict=actor_id%2Ckey_id%2Cnonce');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.headers.apikey, 'sb_secret_server-secret');
  assert.equal(request.init.headers.authorization, undefined);
  assert.equal(request.init.headers.prefer, 'resolution=ignore-duplicates,return=representation');
  assert.deepEqual(JSON.parse(request.init.body), [{ actor_id: 'actor-1', key_id: 'key-1', nonce: 'nonce-0123456789abcdef', consumed_at: '2026-08-08T00:00:00.000Z' }]);
});

test('keeps legacy service-role JWT compatibility with apikey and Bearer headers', async () => {
  let request;
  const store = createSupabaseNonceStore({
    env: LEGACY_ENV,
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify([{ nonce: 'nonce-0123456789abcdef' }]), { status: 201, headers: { 'content-type': 'application/json' } });
    },
  });
  assert.equal(await store.claimSignatureNonce({ actorId: 'actor-1', keyId: 'key-1', nonce: 'nonce-0123456789abcdef' }), true);
  assert.equal(request.init.headers.apikey, 'legacy-service-role-jwt');
  assert.equal(request.init.headers.authorization, 'Bearer legacy-service-role-jwt');
});

test('treats an ignored duplicate as a replay without a second write', async () => {
  const store = createSupabaseNonceStore({ env: MODERN_ENV, fetchImpl: async () => new Response('[]', { status: 201, headers: { 'content-type': 'application/json' } }) });
  assert.equal(await store.claimSignatureNonce({ actorId: 'actor-1', keyId: 'key-1', nonce: 'nonce-0123456789abcdef' }), false);
});

test('fails closed for missing configuration and upstream failures without leaking secrets', async () => {
  assert.throws(() => createSupabaseNonceStore({ env: {} }), (error) => error instanceof SupabaseNonceStoreError && error.code === 'CLIENT_SIGNATURE_UNAVAILABLE');
  const store = createSupabaseNonceStore({ env: MODERN_ENV, fetchImpl: async () => new Response('upstream body containing sb_secret_server-secret', { status: 500 }) });
  await assert.rejects(store.claimSignatureNonce({ actorId: 'actor-1', keyId: 'key-1', nonce: 'nonce-0123456789abcdef' }), (error) => error instanceof SupabaseNonceStoreError && !error.message.includes('server-secret'));
});
