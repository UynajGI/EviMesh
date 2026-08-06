import test from 'node:test';
import assert from 'node:assert/strict';
import { appendActorResearchEvent, appendObjectResearchEvent, appendResearchEvent, appendResearchEventWithOutbox, getResearchEventSignature, ResearchEventAppendError } from '../src/research-event-service.mjs';

const parentId = '018f0f4a-5c00-7000-8000-000000000000';
const eventId = '018f0f4a-5c00-7000-8000-000000000001';
const event = {
  event_id: eventId,
  event_type: 'claim.revised',
  payload: { claim_id: 'claim_1', revision: 2 },
  hash: `sha256:${'a'.repeat(64)}`,
  signature: { algorithm: 'Ed25519', key_id: 'key_1', value: 'signature' },
  parents: [parentId],
};

function repository({ existing = new Set([parentId]) } = {}) {
  const calls = [];
  const repo = {
    calls,
    withTransaction: async (callback) => callback(repo),
    getResearchEvent: async (id) => existing.has(id) ? { eventId: id } : null,
    getLatestObjectEventHash: async () => null,
    getLatestActorEventHash: async () => null,
    insertResearchEvent: async (record) => { calls.push(['event', record]); existing.add(record.eventId); return record; },
    insertResearchEventParent: async (record) => { calls.push(['parent', record]); return record; },
    insertEventOutbox: async (record) => { calls.push(['outbox', record]); return record; },
  };
  return repo;
}

test('appends a signed Event and every parent link in one transaction', async () => {
  const repo = repository();
  const result = await appendResearchEvent({ repository: repo, event });
  assert.equal(result.event.eventId, eventId);
  assert.deepEqual(result.parents, [{ eventId, parentEventId: parentId }]);
  assert.deepEqual(repo.calls.map(([kind]) => kind), ['event', 'parent']);
});

test('writes the formal Event and its pending outbox row in the same transaction', async () => {
  const repo = repository();
  const result = await appendResearchEventWithOutbox({ repository: repo, event, outboxId: 'outbox_1' });
  assert.deepEqual(repo.calls.map(([kind]) => kind), ['event', 'parent', 'outbox']);
  assert.deepEqual(result.outbox, { outboxId: 'outbox_1', eventId, status: 'pending' });
});

test('requires an outbox writer before opening the formal Event transaction', async () => {
  const repo = repository();
  delete repo.insertEventOutbox;
  await assert.rejects(
    appendResearchEventWithOutbox({ repository: repo, event, outboxId: 'outbox_1' }),
    /repository insertEventOutbox is required/,
  );
  assert.equal(repo.calls.length, 0);
});

test('binds a signed Event to the current Actor event hash chain head', async () => {
  const previousEventHash = `sha256:${'d'.repeat(64)}`;
  const repo = repository();
  repo.getLatestActorEventHash = async (actorId) => {
    assert.equal(actorId, 'actor_1');
    return previousEventHash;
  };
  const result = await appendActorResearchEvent({
    repository: repo,
    actorId: 'actor_1',
    eventFactory: async ({ actorId, previousEventHash: receivedPreviousHash }) => ({
      ...event,
      payload: {
        claim_id: 'claim_1',
        integrity: { actor_id: actorId, previous_actor_event_hash: receivedPreviousHash },
      },
    }),
  });
  assert.equal(result.event.payload.integrity.previous_actor_event_hash, previousEventHash);
});

test('rejects an Event that substitutes a different Actor chain head', async () => {
  const repo = repository();
  repo.getLatestActorEventHash = async () => `sha256:${'d'.repeat(64)}`;
  await assert.rejects(
    appendActorResearchEvent({
      repository: repo,
      actorId: 'actor_1',
      eventFactory: async () => ({
        ...event,
        payload: { claim_id: 'claim_1', integrity: { actor_id: 'actor_1', previous_actor_event_hash: null } },
      }),
    }),
    (error) => error.code === 'ACTOR_EVENT_HASH_CHAIN_CONFLICT' && error.status === 409,
  );
  assert.equal(repo.calls.length, 0);
});

test('binds a signed Event to the current object event hash chain head', async () => {
  const previousEventHash = `sha256:${'b'.repeat(64)}`;
  const repo = repository();
  repo.getLatestObjectEventHash = async ({ objectType, objectId }) => {
    assert.deepEqual({ objectType, objectId }, { objectType: 'claim', objectId: 'claim_1' });
    return previousEventHash;
  };
  const result = await appendObjectResearchEvent({
    repository: repo,
    objectType: 'claim',
    objectId: 'claim_1',
    eventFactory: async ({ objectType, objectId, previousEventHash: receivedPreviousHash }) => ({
      ...event,
      payload: {
        claim_id: 'claim_1',
        revision: 2,
        integrity: { object_type: objectType, object_id: objectId, previous_event_hash: receivedPreviousHash },
      },
    }),
  });
  assert.equal(result.event.payload.integrity.previous_event_hash, previousEventHash);
  assert.equal(repo.calls[0][1].payload.integrity.previous_event_hash, previousEventHash);
});

test('rejects an Event that substitutes a different object chain head', async () => {
  const repo = repository();
  repo.getLatestObjectEventHash = async () => `sha256:${'b'.repeat(64)}`;
  await assert.rejects(
    appendObjectResearchEvent({
      repository: repo,
      objectType: 'claim',
      objectId: 'claim_1',
      eventFactory: async () => ({
        ...event,
        payload: {
          claim_id: 'claim_1',
          integrity: { object_type: 'claim', object_id: 'claim_1', previous_event_hash: `sha256:${'c'.repeat(64)}` },
        },
      }),
    }),
    (error) => error.code === 'OBJECT_EVENT_HASH_CHAIN_CONFLICT' && error.status === 409,
  );
  assert.equal(repo.calls.length, 0);
});

test('rejects duplicate events, duplicate parents, and missing parents before persistence', async () => {
  const duplicate = repository({ existing: new Set([parentId, eventId]) });
  await assert.rejects(
    appendResearchEvent({ repository: duplicate, event }),
    (error) => error instanceof ResearchEventAppendError && error.code === 'RESEARCH_EVENT_EXISTS',
  );
  assert.equal(duplicate.calls.length, 0);

  const duplicateParents = repository();
  await assert.rejects(
    appendResearchEvent({ repository: duplicateParents, event: { ...event, parents: [parentId, parentId] } }),
    /parents must be unique/,
  );
  assert.equal(duplicateParents.calls.length, 0);

  const missingParent = repository({ existing: new Set() });
  await assert.rejects(
    appendResearchEvent({ repository: missingParent, event }),
    (error) => error.code === 'RESEARCH_EVENT_PARENT_NOT_FOUND' && error.status === 404,
  );
  assert.equal(missingParent.calls.length, 0);
});

test('returns the original stored client signature without re-encoding it', async () => {
  const signature = { algorithm: 'Ed25519', key_id: 'client-key-1', value: 'original-base64url-signature', nonce: 'unchanged' };
  const returned = await getResearchEventSignature({
    repository: { getResearchEvent: async (id) => id === eventId ? { eventId: id, signature } : null },
    eventId,
  });
  assert.strictEqual(returned, signature);
  await assert.rejects(
    getResearchEventSignature({ repository: { getResearchEvent: async () => null }, eventId: 'missing' }),
    (error) => error.code === 'RESEARCH_EVENT_NOT_FOUND' && error.status === 404,
  );
});
