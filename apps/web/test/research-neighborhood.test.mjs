import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterResearchNeighborhood,
  nodeRevisionKey,
  normalizeResearchNeighborhood,
  RESEARCH_NODE_KINDS,
  relationshipsForSelection,
} from '../lib/research-neighborhood.mjs';

const instant = '2026-08-31T08:00:00.000Z';

function node(kind, id, revision, family, overrides = {}) {
  return {
    ref: { kind, id, revision },
    label: `${kind} ${id}`,
    family,
    state: 'published',
    canonicalHref: `/${kind}/${id}`,
    createdAt: instant,
    createdBy: 'actor_agent',
    isCurrent: true,
    ...overrides,
  };
}

function edge(id, type, source, target, family, forwardLabel, reverseLabel) {
  return {
    id, type, source, target, family, forwardLabel, reverseLabel,
    provenanceEventId: `event_${id}`,
  };
}

const v1Fixture = {
  schemaVersion: 'research-neighborhood.v1',
  requestedRoot: { kind: 'answer', id: 'ans_1', revision: 2 },
  resolvedRoot: { kind: 'answer', id: 'ans_1', revision: 2 },
  nodes: [
    node('question', 'qst_1', 4, 'structure'),
    node('answer', 'ans_1', 1, 'reasoning', { isCurrent: false }),
    node('answer', 'ans_1', 2, 'reasoning'),
    node('claim', 'clm_1', 3, 'reasoning'),
    node('evaluation', 'eva_1', 1, 'reasoning'),
  ],
  edges: [
    edge('edge_answers', 'answers', { kind: 'question', id: 'qst_1', revision: 4 }, { kind: 'answer', id: 'ans_1', revision: 1 }, 'reasoning', 'answered by', 'answers'),
    edge('edge_supersedes', 'supersedes', { kind: 'answer', id: 'ans_1', revision: 1 }, { kind: 'answer', id: 'ans_1', revision: 2 }, 'lineage', 'superseded by', 'supersedes'),
    edge('edge_claim', 'yields_claim', { kind: 'answer', id: 'ans_1', revision: 2 }, { kind: 'claim', id: 'clm_1', revision: 3 }, 'reasoning', 'yields claim', 'derived from answer'),
    edge('edge_evaluation', 'evaluates', { kind: 'claim', id: 'clm_1', revision: 3 }, { kind: 'evaluation', id: 'eva_1', revision: 1 }, 'evaluation', 'evaluated by', 'evaluates'),
  ],
  truncated: false,
  permissionPartial: false,
  nextCursor: null,
  graphWatermark: 'graph:42',
};

test('normalizer consumes the real research-neighborhood.v1 ref shape without losing revisions', () => {
  const graph = normalizeResearchNeighborhood(v1Fixture);
  assert.equal(graph.nodes.length, 5);
  assert.equal(graph.edges.length, 4);
  assert.equal(graph.complete, true);
  assert.equal(graph.rootKey, 'answer:ans_1@2');
  assert.equal(graph.graphWatermark, 'graph:42');
  assert.deepEqual(
    graph.nodes.filter(({ id }) => id === 'ans_1').map(({ key }) => key),
    ['answer:ans_1@1', 'answer:ans_1@2'],
  );
  const claim = graph.nodes.find(({ id }) => id === 'clm_1');
  assert.equal(claim.family, 'reasoning');
  assert.equal(claim.canonicalHref, '/claim/clm_1');
  assert.equal(claim.direction, 'downstream');
  assert.equal(claim.distance, 1);
  assert.deepEqual(graph.edges[2], assertPartial({
    source: 'answer:ans_1@2',
    target: 'claim:clm_1@3',
    relation: 'yields_claim',
    family: 'reasoning',
    forwardLabel: 'yields claim',
    reverseLabel: 'derived from answer',
  }, graph.edges[2]));
});

test('all 23 protocol node kinds keep their type and revision-qualified identity', () => {
  assert.equal(RESEARCH_NODE_KINDS.length, 23);
  const familyByKind = new Map([
    ...['project', 'research_contract', 'question'].map((kind) => [kind, 'structure']),
    ...['answer', 'claim', 'rebuttal', 'evaluation'].map((kind) => [kind, 'reasoning']),
    ...['dataset', 'tool', 'artifact', 'evidence'].map((kind) => [kind, 'resource']),
    ...['task', 'attempt', 'context_bundle', 'run'].map((kind) => [kind, 'execution']),
    ...['verification_contract', 'verification_policy', 'policy_evaluation', 'verification_receipt', 'verification_finding', 'challenge', 'merge_proposal', 'frontier_snapshot'].map((kind) => [kind, 'verification']),
  ]);
  const graph = normalizeResearchNeighborhood({
    schemaVersion: 'research-neighborhood.v1',
    requestedRoot: { kind: 'project', id: 'object_0', revision: 1 },
    resolvedRoot: { kind: 'project', id: 'object_0', revision: 1 },
    nodes: RESEARCH_NODE_KINDS.map((kind, index) => node(kind, `object_${index}`, index + 1, familyByKind.get(kind))),
    edges: [],
    truncated: false,
    permissionPartial: false,
  });
  assert.deepEqual(graph.nodes.map(({ type }) => type), RESEARCH_NODE_KINDS);
  for (const item of graph.nodes) assert.equal(item.key, nodeRevisionKey(item.ref));
});

test('wire completeness is fail-closed for truncation, permissions, and local filters', () => {
  assert.equal(normalizeResearchNeighborhood({ ...v1Fixture, truncated: true }).complete, false);
  assert.equal(normalizeResearchNeighborhood({ ...v1Fixture, permissionPartial: true }).complete, false);
  const graph = normalizeResearchNeighborhood(v1Fixture);
  const filtered = filterResearchNeighborhood(graph, { direction: 'downstream', focusId: 'ans_1', maxDepth: 1 });
  assert.equal(filtered.complete, false);
  assert.deepEqual(filtered.nodes.map(({ key }) => key), ['answer:ans_1@2', 'claim:clm_1@3']);
  assert.deepEqual(filtered.edges.map(({ id }) => id), ['edge_claim']);
});

test('relationship index reads direction-specific labels from the same normalized edges', () => {
  const graph = normalizeResearchNeighborhood(v1Fixture);
  const atCurrentAnswer = relationshipsForSelection(graph.nodes, graph.edges, 'answer:ans_1@2');
  assert.equal(atCurrentAnswer.upstream[0].node.key, 'answer:ans_1@1');
  assert.equal(atCurrentAnswer.upstream[0].relationLabel, 'supersedes');
  assert.equal(atCurrentAnswer.downstream[0].node.type, 'claim');
  assert.equal(atCurrentAnswer.downstream[0].relationLabel, 'yields claim');
});

test('legacy Claim elements remain readable and dangling edges are dropped', () => {
  const graph = normalizeResearchNeighborhood([
    { data: { id: 'clm_a', label: 'A claim', state: 'candidate' } },
    { data: { id: 'evd_b', nodeType: 'evidence', label: 'A finding' } },
    { data: { id: 'edge_1', source: 'clm_a', target: 'evd_b', relationType: 'evaluated_by' } },
    { data: { id: 'edge_2', source: 'missing', target: 'evd_b', relationType: 'depends_on' } },
  ]);
  assert.deepEqual(graph.nodes.map(({ id, type }) => ({ id, type })), [
    { id: 'clm_a', type: 'claim' },
    { id: 'evd_b', type: 'evidence' },
  ]);
  assert.deepEqual(graph.edges.map(({ source, target }) => ({ source, target })), [
    { source: 'claim:clm_a@1', target: 'evidence:evd_b@1' },
  ]);
});

function assertPartial(expected, actual) {
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(actual[key], value);
  return actual;
}
