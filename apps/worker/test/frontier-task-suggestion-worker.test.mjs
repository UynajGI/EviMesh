import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrontierTaskSuggestionsJob } from '../src/frontier-task-suggestion-worker.mjs';

test('generates deduplicated open-blocker Task suggestions after a Frontier is published', async () => {
  const created = [];
  const repository = {
    getFrontierSnapshot: async () => ({ snapshotId: 'frontier-1' }),
    listFrontierOpenBlockers: async () => [{ blockerId: 'blocker-new', title: 'Reproduce conflicting run' }, { blockerId: 'blocker-existing', title: 'Already suggested' }],
    listFrontierTaskSuggestions: async () => [{ blockerId: 'blocker-existing', type: 'open_blocker' }],
    createFrontierTaskSuggestion: async (suggestion) => { created.push(suggestion); return suggestion; },
  };
  const result = await createFrontierTaskSuggestionsJob({ repository, snapshotId: 'frontier-1', suggestionIdFactory: ({ blockerId }) => `suggestion-${blockerId}` });
  assert.deepEqual(created, [{ suggestionId: 'suggestion-blocker-new', snapshotId: 'frontier-1', blockerId: 'blocker-new', type: 'open_blocker', title: 'Reproduce conflicting run' }]);
  assert.deepEqual(result.suggestions, created);
});
