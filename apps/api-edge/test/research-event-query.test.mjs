import test from 'node:test';
import assert from 'node:assert/strict';
import { listResearchEvents, ResearchEventQueryError } from '../src/research-event-query.mjs';

const events = [
  { eventId: 'event_3', createdAt: '2026-08-06T03:00:00.000Z' },
  { eventId: 'event_2', createdAt: '2026-08-06T02:00:00.000Z' },
  { eventId: 'event_1', createdAt: '2026-08-06T01:00:00.000Z' },
];

test('filters Events by object, Actor, type, and time range before cursor pagination', async () => {
  let receivedFilters;
  const result = await listResearchEvents({
    repository: {
      listResearchEvents: async (filters) => {
        receivedFilters = filters;
        return events;
      },
    },
    objectType: 'claim',
    objectId: 'claim_1',
    actorId: 'actor_1',
    eventType: 'claim.revised',
    createdAfter: '2026-08-06T00:00:00Z',
    createdBefore: '2026-08-06T04:00:00Z',
    limit: 2,
  });
  assert.deepEqual(receivedFilters, {
    objectType: 'claim',
    objectId: 'claim_1',
    actorId: 'actor_1',
    eventType: 'claim.revised',
    createdAfter: '2026-08-06T00:00:00.000Z',
    createdBefore: '2026-08-06T04:00:00.000Z',
  });
  assert.deepEqual(result.items.map((event) => event.eventId), ['event_1', 'event_2']);
  assert.ok(result.nextCursor);
});

test('validates paired object filters, time bounds, and pagination input', async () => {
  const repository = { listResearchEvents: async () => [] };
  await assert.rejects(
    listResearchEvents({ repository, objectType: 'claim' }),
    (error) => error instanceof ResearchEventQueryError && /provided together/.test(error.message),
  );
  await assert.rejects(
    listResearchEvents({ repository, createdAfter: 'not-a-time' }),
    /ISO-8601 timestamp/,
  );
  await assert.rejects(
    listResearchEvents({ repository, createdAfter: '2026-08-07T00:00:00Z', createdBefore: '2026-08-06T00:00:00Z' }),
    /must not be later/,
  );
  await assert.rejects(
    listResearchEvents({ repository, limit: 101 }),
    /integer between 1 and 100/,
  );
});
