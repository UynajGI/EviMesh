import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { signingKeys } from '../src/signing-keys.mjs';

test('signing_keys stores public Ed25519 verification material only', () => {
  const columns = getTableColumns(signingKeys);

  assert.equal(columns.keyId.name, 'key_id');
  assert.equal(columns.keyId.primary, true);
  assert.equal(columns.actorId.name, 'actor_id');
  assert.equal(columns.actorId.notNull, true);
  assert.equal(columns.algorithm.name, 'algorithm');
  assert.equal(columns.algorithm.notNull, true);
  assert.equal(columns.algorithm.default, 'Ed25519');
  assert.equal(columns.publicKey.name, 'public_key');
  assert.equal(columns.publicKey.notNull, true);
  assert.equal(columns.revokedAt.name, 'revoked_at');
  assert.equal(columns.revokedAt.notNull, false);
});
