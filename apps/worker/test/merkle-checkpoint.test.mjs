import test from 'node:test';
import assert from 'node:assert/strict';
import { createMerkleCheckpoint, MerkleCheckpointError } from '../src/merkle-checkpoint.mjs';
import { buildMerkleTree } from '../../../packages/merkle/src/merkle-tree.mjs';
import { hashResearchEventLeaf } from '../../../packages/merkle/src/research-event-leaf.mjs';

function event(eventId, hash) {
  return {
    eventId,
    eventType: 'claim.created',
    payload: { integrity: { object_type: 'claim', object_id: 'claim_1', previous_event_hash: null } },
    hash,
    signature: { algorithm: 'ed25519', value: 'signature' },
    parents: [],
  };
}

test('creates a deterministic unsigned checkpoint for an inclusive continuous Event range', async () => {
  const events = [
    event('event_1', `sha256:${'a'.repeat(64)}`),
    event('event_2', `sha256:${'b'.repeat(64)}`),
    event('event_3', `sha256:${'c'.repeat(64)}`),
  ];
  const checkpoint = await createMerkleCheckpoint({
    repository: { listResearchEventRange: async () => events },
    firstEventId: 'event_1',
    lastEventId: 'event_3',
  });
  const expectedRoot = buildMerkleTree(events.map((item) => hashResearchEventLeaf({
    schema: 'srp.event.v1', event_id: item.eventId, event_type: item.eventType,
    payload: item.payload, hash: item.hash, signature: item.signature, parents: item.parents,
  }))).root;

  assert.deepEqual(checkpoint, {
    schema: 'evimesh.merkle-checkpoint.v1',
    firstEventId: 'event_1',
    lastEventId: 'event_3',
    eventCount: 3,
    rootHash: expectedRoot,
  });
});

test('rejects empty, incomplete, and malformed Event ranges', async () => {
  await assert.rejects(
    createMerkleCheckpoint({ repository: { listResearchEventRange: async () => [] }, firstEventId: 'event_1', lastEventId: 'event_1' }),
    (error) => error instanceof MerkleCheckpointError && error.code === 'MERKLE_CHECKPOINT_RANGE_EMPTY',
  );
  await assert.rejects(
    createMerkleCheckpoint({ repository: { listResearchEventRange: async () => [event('event_1', `sha256:${'a'.repeat(64)}`)] }, firstEventId: 'event_1', lastEventId: 'event_2' }),
    (error) => error.code === 'MERKLE_CHECKPOINT_RANGE_INCOMPLETE',
  );
  await assert.rejects(
    createMerkleCheckpoint({ repository: { listResearchEventRange: async () => [{ eventId: 'event_1' }] }, firstEventId: 'event_1', lastEventId: 'event_1' }),
    (error) => error.code === 'MERKLE_CHECKPOINT_EVENT_INVALID',
  );
});
