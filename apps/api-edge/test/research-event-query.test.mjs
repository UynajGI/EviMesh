import test from 'node:test';
import assert from 'node:assert/strict';
import { listResearchEvents, ResearchEventQueryError } from '../src/research-event-query.mjs';

const events = [
  { eventId: 'event_3', createdAt: '2026-08-06T03:00:00.000Z' },
  { eventId: 'event_2', createdAt: '2026-08-06T02:00:00.000Z' },
  { eventId: 'event_1', createdAt: '2026-08-06T01:00:00.000Z' },
];

function encodedCursor(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

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
    order: 'asc',
  });
  assert.deepEqual(result.items.map((event) => event.eventId), ['event_1', 'event_2']);
  assert.ok(result.nextCursor);
});

test('supports newest-first event pagination', async () => {
  let receivedFilters;
  const result = await listResearchEvents({
    repository: { listResearchEvents: async (filters) => { receivedFilters = filters; return events; } },
    order: 'desc',
    limit: 2,
  });
  assert.equal(receivedFilters.order, 'desc');
  assert.deepEqual(result.items.map((event) => event.eventId), ['event_3', 'event_2']);
  assert.ok(result.nextCursor);
  const next = await listResearchEvents({
    repository: { listResearchEvents: async () => events },
    order: 'desc',
    limit: 2,
    cursor: result.nextCursor,
  });
  assert.deepEqual(next.items.map((event) => event.eventId), ['event_1']);
});

test('offers actor-only pagination boundaries to repositories without changing cursor semantics', async () => {
  const requests = [];
  const repository = {
    listResearchEvents: async (filters) => {
      requests.push(filters);
      return events;
    },
  };
  const first = await listResearchEvents({ repository, actorId: 'actor_1', limit: 2 });
  assert.deepEqual(requests[0].page, { after: null, limit: 3 });
  assert.deepEqual(first.items.map((event) => event.eventId), ['event_1', 'event_2']);

  const second = await listResearchEvents({ repository, actorId: 'actor_1', limit: 2, cursor: first.nextCursor });
  assert.deepEqual(requests[1].page, {
    after: { createdAt: '2026-08-06T02:00:00.000Z', id: 'event_2' },
    limit: 3,
  });
  assert.deepEqual(second.items.map((event) => event.eventId), ['event_3']);
});

test('rejects unsafe actor-only cursor structures before calling the repository', async () => {
  let calls = 0;
  const repository = { listResearchEvents: async () => { calls += 1; return []; } };
  const invalidCursors = [
    encodedCursor([]),
    encodedCursor('not-an-object'),
    encodedCursor({ createdAt: '2026-08-06T02:00:00.000Z' }),
    encodedCursor({ createdAt: 'not-an-iso-timestamp', id: 'event_2' }),
    encodedCursor({ createdAt: '2026-02-31T02:00:00.000Z', id: 'event_2' }),
    encodedCursor({ createdAt: '2026-08-06T02:00:00.000Z),event_id.gt.injected', id: 'event_2' }),
    encodedCursor({ createdAt: '2026-08-06T02:00:00.000Z', id: 'event_2),created_at.gt.1900-01-01T00:00:00Z' }),
  ];

  for (const cursor of invalidCursors) {
    await assert.rejects(
      listResearchEvents({ repository, actorId: 'actor_1', cursor }),
      (error) => error instanceof TypeError && error.message === 'invalid pagination cursor',
    );
  }
  assert.equal(calls, 0);
});

test('accepts UUIDv7 actor-only cursor identifiers', async () => {
  let received;
  const after = {
    createdAt: '2026-08-06T02:00:00.000Z',
    id: '0198b2b0-8d74-7c31-8d16-42d9ac8db4a1',
  };
  await listResearchEvents({
    repository: { listResearchEvents: async (filters) => { received = filters.page.after; return []; } },
    actorId: 'actor_1',
    cursor: encodedCursor(after),
  });
  assert.deepEqual(received, after);
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
  await assert.rejects(listResearchEvents({ repository, order: 'newest' }), /order must be asc or desc/);
});
