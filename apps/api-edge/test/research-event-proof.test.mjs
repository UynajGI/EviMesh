import test from 'node:test';
import assert from 'node:assert/strict';
import { getResearchEventInclusionProof, ResearchEventProofError } from '../src/research-event-proof.mjs';
import { buildMerkleTree } from '../../../packages/merkle/src/merkle-tree.mjs';
import { hashResearchEventLeaf } from '../../../packages/merkle/src/research-event-leaf.mjs';
import { verifyMerkleInclusionProof } from '../../../packages/merkle/src/verify-inclusion-proof.mjs';

function event(eventId, hash) {
  return { eventId, eventType: 'claim.created', payload: { claim_id: 'claim_1' }, hash, signature: { algorithm: 'Ed25519', value: 'sig' }, parents: [] };
}

const events = [event('event_1', `sha256:${'a'.repeat(64)}`), event('event_2', `sha256:${'b'.repeat(64)}`), event('event_3', `sha256:${'c'.repeat(64)}`)];
const rootHash = buildMerkleTree(events.map((item) => hashResearchEventLeaf({ schema: 'srp.event.v1', event_id: item.eventId, event_type: item.eventType, payload: item.payload, hash: item.hash, signature: item.signature, parents: item.parents }))).root;

test('returns a verifiable proof for an Event covered by a published checkpoint', async () => {
  let requestedEventId;
  let requestedRange;
  const result = await getResearchEventInclusionProof({
    repository: {
      getMerkleCheckpointForEvent: async (eventId) => { requestedEventId = eventId; return { checkpointId: 'checkpoint_1', firstEventId: 'event_1', lastEventId: 'event_3', rootHash }; },
      listResearchEventRange: async (range) => { requestedRange = range; return events; },
    },
    eventId: 'event_2',
  });
  assert.equal(requestedEventId, 'event_2');
  assert.deepEqual(requestedRange, { firstEventId: 'event_1', lastEventId: 'event_3' });
  assert.equal(result.checkpointId, 'checkpoint_1');
  assert.equal(result.proof.leafIndex, 1);
  assert.equal(result.proof.root, rootHash);
  assert.equal(verifyMerkleInclusionProof(result.proof), true);
});

test('rejects Events without a checkpoint and ranges that do not match the published root', async () => {
  await assert.rejects(
    getResearchEventInclusionProof({ repository: { getMerkleCheckpointForEvent: async () => null, listResearchEventRange: async () => [] }, eventId: 'event_1' }),
    (error) => error instanceof ResearchEventProofError && error.code === 'RESEARCH_EVENT_CHECKPOINT_NOT_FOUND' && error.status === 404,
  );
  await assert.rejects(
    getResearchEventInclusionProof({ repository: { getMerkleCheckpointForEvent: async () => ({ checkpointId: 'checkpoint_1', firstEventId: 'event_1', lastEventId: 'event_3', rootHash: `sha256:${'f'.repeat(64)}` }), listResearchEventRange: async () => events }, eventId: 'event_2' }),
    (error) => error.code === 'RESEARCH_EVENT_PROOF_ROOT_MISMATCH' && error.status === 500,
  );
});
