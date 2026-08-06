import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.mjs';
import { getPlatformPublicKeys, PlatformPublicKeysError } from '../src/platform-public-keys.mjs';

const keyring = {
  activeKey: { keyId: 'platform-new', publicKey: 'public-new', privateKey: 'must-not-leak' },
  retiredKeys: [{ keyId: 'platform-old', publicKey: 'public-old', privateKey: 'must-not-leak' }],
};

test('publishes key_id-indexed public keys without private material', () => {
  assert.deepEqual(getPlatformPublicKeys({ keyring }), {
    active_key_id: 'platform-new',
    keys: [
      { key_id: 'platform-new', algorithm: 'Ed25519', public_key: 'public-new' },
      { key_id: 'platform-old', algorithm: 'Ed25519', public_key: 'public-old' },
    ],
  });
  assert.throws(() => getPlatformPublicKeys({ keyring: {} }), PlatformPublicKeysError);
});

test('serves the public key set and fails closed for absent configuration', async () => {
  const response = await app.request('https://api.evimesh.test/platform/keys', {}, { PLATFORM_KEYRING: JSON.stringify(keyring) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    active_key_id: 'platform-new',
    keys: [
      { key_id: 'platform-new', algorithm: 'Ed25519', public_key: 'public-new' },
      { key_id: 'platform-old', algorithm: 'Ed25519', public_key: 'public-old' },
    ],
  });
  const unavailable = await app.request('https://api.evimesh.test/platform/keys');
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).code, 'platform_keys_unavailable');
});
