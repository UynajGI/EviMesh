import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson, rawHash } from '../../../packages/protocol/src/hash.mjs';
import { generateEd25519KeyPair } from '../../../packages/signatures/src/ed25519.mjs';
import { verifyEd25519Payload } from '../../../packages/signatures/src/server-verification.mjs';
import {
  createPlatformResearchEventFactory,
  createPlatformResearchEventFactoryFromEnv,
  PlatformResearchEventFactoryError,
} from '../src/platform-research-event-factory.mjs';

test('creates a canonical platform-signed ResearchEvent and verifies it with the published key', async () => {
  const keys = generateEd25519KeyPair();
  const factory = createPlatformResearchEventFactory({
    keyId: 'platform-2026-08',
    privateKey: keys.private_key,
    publicKey: keys.public_key,
  });
  const payload = { actor_id: 'actor_agent', typed_document: { answerId: 'answer_1', revision: 1 } };
  const event = await factory({ eventType: 'answer.created', payload });
  const signingBytes = new TextEncoder().encode(canonicalJson({
    event_type: event.event_type,
    payload: event.payload,
    parents: event.parents,
  }));

  assert.equal(event.schema, 'srp.event.v1');
  assert.equal(event.event_type, 'answer.created');
  assert.deepEqual(event.payload, payload);
  assert.deepEqual(event.parents, []);
  assert.equal(event.signature.algorithm, 'Ed25519');
  assert.equal(event.signature.key_id, 'platform-2026-08');
  assert.equal(event.hash, `sha256:${rawHash(new TextDecoder().decode(signingBytes))}`);
  assert.equal(await verifyEd25519Payload({
    signingBytes,
    signature: event.signature.value,
    publicKey: keys.public_key,
  }), true);
});

test('resolves only a separate private secret matching the active public key id', async () => {
  const keys = generateEd25519KeyPair();
  const env = {
    PLATFORM_KEYRING: JSON.stringify({
      activeKey: { keyId: 'platform-current', publicKey: keys.public_key },
      retiredKeys: [],
    }),
    PLATFORM_EVENT_SIGNING_KEY_ID: 'platform-current',
    PLATFORM_EVENT_SIGNING_PRIVATE_KEY: keys.private_key,
  };
  const factory = createPlatformResearchEventFactoryFromEnv({ env });
  assert.equal(typeof factory, 'function');
  assert.equal((await factory({ eventType: 'tool.created', payload: { actor_id: 'actor_agent' } })).signature.key_id, 'platform-current');

  assert.equal(createPlatformResearchEventFactoryFromEnv({ env: { ...env, PLATFORM_EVENT_SIGNING_PRIVATE_KEY: undefined } }), null);
  assert.equal(createPlatformResearchEventFactoryFromEnv({ env: { ...env, PLATFORM_EVENT_SIGNING_KEY_ID: 'retired-key' } }), null);
  assert.equal(createPlatformResearchEventFactoryFromEnv({ env: { ...env, PLATFORM_KEYRING: '{bad-json' } }), null);
});

test('fails closed when the private key does not match the active public key', async () => {
  const active = generateEd25519KeyPair();
  const wrong = generateEd25519KeyPair();
  const factory = createPlatformResearchEventFactory({
    keyId: 'platform-current',
    privateKey: wrong.private_key,
    publicKey: active.public_key,
  });
  await assert.rejects(
    () => factory({ eventType: 'dataset.created', payload: { actor_id: 'actor_agent' } }),
    (error) => error instanceof PlatformResearchEventFactoryError
      && error.code === 'PLATFORM_EVENT_SIGNING_KEY_MISMATCH'
      && error.status === 503,
  );
});
