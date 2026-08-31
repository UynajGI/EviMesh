import test from 'node:test';
import assert from 'node:assert/strict';
import { readResearchNeighborhood, researchNeighborhoodPath } from '../lib/research-object-data.mjs';
import { normalizeResearchNeighborhood } from '../lib/research-neighborhood.mjs';

const wireFixture = {
  schemaVersion: 'research-neighborhood.v1',
  requestedRoot: { kind: 'answer', id: 'answer/one', revision: 2 },
  resolvedRoot: { kind: 'answer', id: 'answer/one', revision: 2 },
  nodes: [{
    ref: { kind: 'answer', id: 'answer/one', revision: 2 },
    label: 'Bounded answer',
    family: 'reasoning',
    state: 'published',
    canonicalHref: '/answers/answer%2Fone',
    createdAt: '2026-08-31T08:00:00.000Z',
    createdBy: 'actor_agent',
    isCurrent: true,
  }],
  edges: [],
  truncated: false,
  permissionPartial: true,
  nextCursor: null,
  graphWatermark: 'graph:72',
};

test('shared detail calls the canonical research graph path and preserves its wire payload', async () => {
  let requestedPath = null;
  const readJson = async (path) => {
    requestedPath = path;
    return wireFixture;
  };
  const result = await readResearchNeighborhood(readJson, {
    kind: 'answer', id: 'answer/one', depth: 3, direction: 'both',
  });
  assert.equal(requestedPath, '/research-graph/answer/answer%2Fone/neighborhood?depth=3&direction=both');
  assert.equal(result, wireFixture);
  const normalized = normalizeResearchNeighborhood(result);
  assert.equal(normalized.nodes[0].key, 'answer:answer/one@2');
  assert.equal(normalized.graphWatermark, 'graph:72');
  assert.equal(normalized.complete, false, 'permission-partial views must never claim complete topology');
});

test('research graph request bounds depth to the protocol range', () => {
  assert.equal(researchNeighborhoodPath('tool', 'tool_1'), '/research-graph/tool/tool_1/neighborhood?depth=3&direction=both');
  assert.throws(() => researchNeighborhoodPath('tool', 'tool_1', { depth: 4 }), /between 1 and 3/);
});
