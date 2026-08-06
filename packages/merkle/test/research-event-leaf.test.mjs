import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeResearchEventLeaf, hashResearchEventLeaf, MerkleLeafError } from '../src/research-event-leaf.mjs';

const event = {
  schema: 'srp.event.v1',
  event_id: '018f0f4a-5c00-7000-8000-000000000001',
  event_type: 'claim.revised',
  payload: { claim_id: 'claim_1', revision: 2 },
  hash: `sha256:${'a'.repeat(64)}`,
  signature: { algorithm: 'Ed25519', key_id: 'key_1', value: 'signature' },
  parents: [],
};

test('encodes the same formal Event into the same canonical Merkle leaf', () => {
  const reordered = {
    ...event,
    payload: { revision: 2, claim_id: 'claim_1' },
    signature: { value: 'signature', key_id: 'key_1', algorithm: 'Ed25519' },
  };
  assert.equal(encodeResearchEventLeaf(event), encodeResearchEventLeaf(reordered));
  assert.equal(hashResearchEventLeaf(event), hashResearchEventLeaf(reordered));
  assert.match(hashResearchEventLeaf(event), /^sha256:[0-9a-f]{64}$/);
});

test('binds every signed Event field and rejects malformed formal Events', () => {
  assert.notEqual(hashResearchEventLeaf(event), hashResearchEventLeaf({ ...event, hash: `sha256:${'b'.repeat(64)}` }));
  assert.throws(() => encodeResearchEventLeaf({ ...event, schema: 'srp.event.v2' }), MerkleLeafError);
  assert.throws(() => encodeResearchEventLeaf({ ...event, parents: 'none' }), /parents/);
});
