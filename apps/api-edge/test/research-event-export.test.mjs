import test from 'node:test';
import assert from 'node:assert/strict';
import { exportResearchEventRangeNdjson, ResearchEventExportError } from '../src/research-event-export.mjs';

test('exports an inclusive contiguous Event range as one NDJSON record per line', async () => {
  let receivedRange;
  const ndjson = await exportResearchEventRangeNdjson({
    repository: {
      listResearchEventRange: async (range) => {
        receivedRange = range;
        return [
          { eventId: 'event_1', eventType: 'claim.created' },
          { eventId: 'event_2', eventType: 'claim.revised' },
        ];
      },
    },
    firstEventId: 'event_1',
    lastEventId: 'event_2',
  });
  assert.deepEqual(receivedRange, { firstEventId: 'event_1', lastEventId: 'event_2' });
  assert.equal(ndjson, '{"eventId":"event_1","eventType":"claim.created"}\n{"eventId":"event_2","eventType":"claim.revised"}\n');
});

test('rejects incomplete, empty, and malformed Event ranges', async () => {
  const incompleteRepository = { listResearchEventRange: async () => [{ eventId: 'event_1' }] };
  await assert.rejects(
    exportResearchEventRangeNdjson({ repository: incompleteRepository, firstEventId: 'event_1', lastEventId: 'event_2' }),
    (error) => error instanceof ResearchEventExportError && error.code === 'RESEARCH_EVENT_RANGE_INCOMPLETE',
  );
  await assert.rejects(
    exportResearchEventRangeNdjson({ repository: { listResearchEventRange: async () => [] }, firstEventId: 'event_1', lastEventId: 'event_1' }),
    (error) => error.code === 'RESEARCH_EVENT_RANGE_EMPTY',
  );
  await assert.rejects(
    exportResearchEventRangeNdjson({ repository: { listResearchEventRange: async () => [] }, firstEventId: ' ' }),
    /first event id/,
  );
});
