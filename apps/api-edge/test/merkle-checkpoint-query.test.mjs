import test from 'node:test';
import assert from 'node:assert/strict';
import { getMerkleCheckpoint, MerkleCheckpointQueryError } from '../src/merkle-checkpoint-query.mjs';

const signature = { algorithm: 'Ed25519', keyId: 'platform-key-1', value: 'signed-value' };
const record = {
  checkpointId: 'checkpoint_1',
  firstEventId: 'event_1',
  lastEventId: 'event_3',
  eventCount: 3,
  rootHash: `sha256:${'a'.repeat(64)}`,
  signature: JSON.stringify(signature),
};

test('returns a checkpoint root, inclusive range, and parsed platform signature', async () => {
  let requestedId;
  const checkpoint = await getMerkleCheckpoint({
    repository: { getMerkleCheckpoint: async (checkpointId) => { requestedId = checkpointId; return record; } },
    checkpointId: 'checkpoint_1',
  });
  assert.equal(requestedId, 'checkpoint_1');
  assert.deepEqual(checkpoint, {
    checkpointId: 'checkpoint_1',
    schema: 'evimesh.merkle-checkpoint.v1',
    firstEventId: 'event_1',
    lastEventId: 'event_3',
    eventCount: 3,
    rootHash: `sha256:${'a'.repeat(64)}`,
    signature,
  });
});

test('returns typed errors for missing and malformed checkpoint records', async () => {
  await assert.rejects(
    getMerkleCheckpoint({ repository: { getMerkleCheckpoint: async () => null }, checkpointId: 'checkpoint_1' }),
    (error) => error instanceof MerkleCheckpointQueryError && error.code === 'MERKLE_CHECKPOINT_NOT_FOUND' && error.status === 404,
  );
  await assert.rejects(
    getMerkleCheckpoint({ repository: { getMerkleCheckpoint: async () => ({ ...record, signature: 'not json' }) }, checkpointId: 'checkpoint_1' }),
    (error) => error.code === 'MERKLE_CHECKPOINT_RESULT_INVALID' && error.status === 500,
  );
  await assert.rejects(getMerkleCheckpoint({ repository: {}, checkpointId: 'checkpoint_1' }), /getMerkleCheckpoint is required/);
});
