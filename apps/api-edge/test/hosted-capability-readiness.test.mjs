import assert from 'node:assert/strict';
import test from 'node:test';
import { generateEd25519KeyPair } from '../../../packages/signatures/src/ed25519.mjs';
import { createWorker } from '../src/index.mjs';

function hostedEnv(overrides = {}) {
  const keys = generateEd25519KeyPair();
  return {
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    SUPABASE_SECRET_KEY: 'sb_secret_test',
    EVIMESH_RELEASE_CHANNEL: 'preview',
    EVIMESH_RESEARCH_PREPARE_ENABLED: 'true',
    EVIMESH_RESEARCH_SUBMIT_ENABLED: 'true',
    EVIMESH_TYPED_RESEARCH_ATOMIC_RPC_READY: 'true',
    RESEARCH_GRAPH_READ_MODE: 'kernel',
    RESEARCH_GRAPH_WRITE_MODE: 'kernel',
    RESEARCH_GRAPH_CUTOVER_READY: 'true',
    PLATFORM_KEYRING: JSON.stringify({
      activeKey: { keyId: 'platform-current', publicKey: keys.public_key },
      retiredKeys: [],
    }),
    PLATFORM_EVENT_SIGNING_KEY_ID: 'platform-current',
    PLATFORM_EVENT_SIGNING_PRIVATE_KEY: keys.private_key,
    ...overrides,
  };
}

async function capabilities(env) {
  const response = await createWorker({ fetchImpl: async () => { throw new Error('capability discovery must not call Supabase'); } }).fetch(
    new Request('https://api.example.test/meta/capabilities'),
    env,
  );
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}

test('hosted capability enables submit only when atomic RPC, kernel cutover, and platform signer are all ready', async () => {
  assert.equal((await capabilities(hostedEnv())).research.submit, true);
  assert.equal((await capabilities(hostedEnv({ EVIMESH_TYPED_RESEARCH_ATOMIC_RPC_READY: 'false' }))).research.submit, false);
  assert.equal((await capabilities(hostedEnv({ RESEARCH_GRAPH_WRITE_MODE: 'dual_write' }))).research.submit, false);
  assert.equal((await capabilities(hostedEnv({ PLATFORM_EVENT_SIGNING_PRIVATE_KEY: undefined }))).research.submit, false);
  assert.equal((await capabilities(hostedEnv({ PLATFORM_EVENT_SIGNING_KEY_ID: 'retired-key' }))).research.submit, false);
});
