import test from 'node:test';
import assert from 'node:assert/strict';
import { appendResearchEvent, ResearchEventAppendError } from '../src/research-event-service.mjs';

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
    insertResearchEvent: async (record) => { calls.push(['event', record]); existing.add(record.eventId); return record; },
    insertResearchEventParent: async (record) => { calls.push(['parent', record]); return record; },
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
