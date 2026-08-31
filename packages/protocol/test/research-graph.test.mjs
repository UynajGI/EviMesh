import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EVALUATION_STANCES,
  RESEARCH_EDGE_DEFINITIONS,
  RESEARCH_EDGE_TYPES,
  RESEARCH_NODE_KINDS,
  TOOL_KINDS,
  assertForwardResearchEdge,
  assertResearchEdge,
  assertResearchEdgeRole,
  legacyClaimRelationMotif,
  legacyChallengeImpactMotif,
  legacyChallengeRevisionMotif,
  legacyEvidenceClaimMotif,
  legacyRunInputMotif,
  legacyRunOutputMotif,
  legacyTaskDependencyMotif,
  normalizeNodeRevisionRef,
  normalizeResearchRevisionLineage,
  validateResearchNeighborhood,
} from '../src/research-graph.mjs';

const ref = (kind, id, revision = 1) => ({ kind, id, revision });

test('publishes the v2.1 node, edge, stance, and tool registries', () => {
  for (const kind of ['question', 'answer', 'claim', 'rebuttal', 'evaluation', 'dataset', 'tool', 'run', 'challenge']) assert.ok(RESEARCH_NODE_KINDS.includes(kind));
  for (const type of [
    'answers', 'yields_claim', 'rebuts', 'evaluates', 'evaluation_basis', 'materializes_dataset',
    'packages_tool', 'materializes_evidence', 'run_input', 'verifies_claim', 'verifies_run',
    'uses_verification_contract', 'reports_finding',
  ]) assert.ok(RESEARCH_EDGE_TYPES.includes(type));
  assert.deepEqual(EVALUATION_STANCES, ['supports', 'refutes', 'qualifies', 'reproduces', 'verifies']);
  assert.deepEqual(TOOL_KINDS, ['skill', 'method', 'software', 'model', 'workflow']);
  for (const definition of Object.values(RESEARCH_EDGE_DEFINITIONS)) {
    assert.equal(definition.sourceRevision, 'exact');
    assert.equal(definition.targetRevision, 'new');
    assert.deepEqual(definition.requiredRoles, ['owner', 'maintainer', 'contributor']);
  }
});

test('normalizes revision refs and rejects invalid endpoint matrices', () => {
  assert.deepEqual(normalizeNodeRevisionRef(ref('question', 'question-1')), ref('question', 'question-1'));
  assert.deepEqual(assertResearchEdge({ type: 'answers', source: ref('question', 'q1'), target: ref('answer', 'a1') }), {
    type: 'answers', source: ref('question', 'q1'), target: ref('answer', 'a1'),
  });
  assert.throws(() => assertResearchEdge({ type: 'answers', source: ref('answer', 'a1'), target: ref('question', 'q1') }), /does not allow/);
  assert.throws(() => assertResearchEdge({ type: 'supersedes', source: ref('claim', 'c1'), target: ref('answer', 'a1') }), /matching node kinds/);
  assert.throws(() => assertResearchEdge({ type: 'derived_from', source: ref('claim', 'c1'), target: ref('claim', 'c1') }), /self-loop/);
});

test('rejects generic endpoint and role downgrades through the fixed registry', () => {
  assert.doesNotThrow(() => assertResearchEdge({ type: 'derived_from', source: ref('evidence', 'e1'), target: ref('answer', 'a1'), actorRole: 'contributor' }));
  assert.doesNotThrow(() => assertResearchEdge({ type: 'requires', source: ref('task', 't1'), target: ref('task', 't2'), actorRole: 'maintainer' }));
  assert.throws(() => assertResearchEdge({ type: 'requires', source: ref('dataset', 'd1'), target: ref('evaluation', 'e1'), actorRole: 'owner' }), /does not allow/);
  assert.throws(() => assertResearchEdge({ type: 'derived_from', source: ref('project', 'p1'), target: ref('tool', 't1'), actorRole: 'owner' }), /does not allow/);
  assert.throws(() => assertResearchEdge({ type: 'uses_dataset', source: ref('claim', 'c1'), target: ref('run', 'r1'), actorRole: 'owner' }), /does not allow/);
  assert.throws(() => assertResearchEdgeRole('answers', 'viewer'), /requires one of these project roles/);
});

test('requires every materialized edge to move forward in tuple rank', () => {
  const edge = { type: 'answers', source: ref('question', 'q1'), target: ref('answer', 'a1') };
  assert.equal(assertForwardResearchEdge({ ...edge, sourceRank: { commitRank: 4, batchRank: 1 }, targetRank: { commitRank: 4, batchRank: 2 } }).type, 'answers');
  assert.throws(() => assertForwardResearchEdge({ ...edge, sourceRank: { commitRank: 5, batchRank: 1 }, targetRank: { commitRank: 4, batchRank: 9 } }), /sourceRank < targetRank/);
  assert.throws(() => assertForwardResearchEdge({ ...edge, sourceRank: { commitRank: 4, batchRank: 2 }, targetRank: { commitRank: 4, batchRank: 2 } }), /sourceRank < targetRank/);
});

test('normalizes only genesis or contiguous research revision lineage', () => {
  assert.deepEqual(normalizeResearchRevisionLineage(), { revision: 1, supersedesRevision: null });
  assert.deepEqual(normalizeResearchRevisionLineage({ revision: 2, supersedesRevision: 1 }), { revision: 2, supersedesRevision: 1 });
  assert.throws(() => normalizeResearchRevisionLineage({ revision: 1, supersedesRevision: 1 }), /must not supersede/);
  assert.throws(() => normalizeResearchRevisionLineage({ revision: 3, supersedesRevision: 1 }), /immediately previous/);
  assert.throws(() => normalizeResearchRevisionLineage({ revision: 2, supersedesRevision: null }), /positive safe integer/);
});

test('maps every legacy Claim relation deterministically and in forward direction', () => {
  const direct = ['depends_on', 'extends', 'supersedes', 'derived_from', 'uses_method', 'uses_dataset', 'implements'];
  const evaluations = ['supports', 'qualifies', 'reproduces', 'verifies'];
  const rebuttals = ['refutes', 'contradicts', 'challenges'];
  const mapped = [...direct, ...evaluations, ...rebuttals].map((relationType) => legacyClaimRelationMotif({ relationType, sourceClaimId: 'source', targetClaimId: 'target', sourceRevision: 1, targetRevision: 1 }));
  assert.equal(mapped.length, 14);
  assert.equal(new Set(mapped.map((item) => item.mappingKey)).size, 14);
  assert.equal(mapped[0].edge.source.id, 'target');
  assert.equal(mapped[0].edge.target.id, 'source');
  assert.deepEqual(mapped.map((item) => item.motif), [...direct.map(() => 'direct'), ...evaluations.map(() => 'evaluation'), ...rebuttals.map(() => 'rebuttal')]);
  assert.deepEqual(legacyClaimRelationMotif({ relationType: 'supports', sourceClaimId: 'source', targetClaimId: 'target', sourceRevision: 1, targetRevision: 1 }), mapped[7]);
  assert.throws(
    () => legacyClaimRelationMotif({ relationType: 'depends_on', sourceClaimId: 'source', targetClaimId: 'target' }),
    /revision must be a positive safe integer/,
  );
});

test('maps all four Evidence links to subject-plus-basis Evaluation motifs', () => {
  for (const stance of ['supports', 'refutes', 'qualifies', 'reproduces']) {
    const motif = legacyEvidenceClaimMotif({ relationType: stance, evidenceId: 'e1', claimId: 'c1', claimRevision: 3 });
    assert.equal(motif.motif, 'evaluation');
    assert.equal(motif.stance, stance);
    assert.deepEqual(motif.subject, ref('claim', 'c1', 3));
    assert.deepEqual(motif.bases, [ref('evidence', 'e1', 1)]);
  }
});

test('maps Challenge, Task, and Run legacy rows in forward DAG direction', () => {
  const challenge = legacyChallengeRevisionMotif({ challengeId: 'challenge-1', challengeRevision: 2, targetClaimId: 'claim-1', targetClaimRevision: 3 });
  assert.deepEqual(challenge.edge, { type: 'challenges', source: ref('claim', 'claim-1', 3), target: ref('challenge', 'challenge-1', 2) });
  assert.deepEqual(challenge.registerTarget, ref('challenge', 'challenge-1', 2));
  const impact = legacyChallengeImpactMotif({ impactId: 'impact-1', impactType: 'scope', challengeId: 'challenge-1', challengeRevision: 2, claimId: 'claim-2', claimRevision: 4 });
  assert.deepEqual(impact.edge, { type: 'challenges', source: ref('claim', 'claim-2', 4), target: ref('challenge', 'challenge-1', 2) });
  const task = legacyTaskDependencyMotif({ sourceTaskId: 'dependent', sourceTaskRevision: 5, targetTaskId: 'prerequisite', targetTaskRevision: 2 });
  assert.deepEqual(task.edge, { type: 'requires', source: ref('task', 'prerequisite', 2), target: ref('task', 'dependent', 5) });
  assert.deepEqual(legacyRunInputMotif({ runId: 'run-1', artifactId: 'input', artifactRevision: 6 }).edge, { type: 'run_input', source: ref('artifact', 'input', 6), target: ref('run', 'run-1') });
  assert.deepEqual(legacyRunOutputMotif({ runId: 'run-1', artifactId: 'output', artifactRevision: 7 }).edge, { type: 'produces_artifact', source: ref('run', 'run-1'), target: ref('artifact', 'output', 7) });
  assert.throws(() => legacyTaskDependencyMotif({ sourceTaskId: 'dependent', targetTaskId: 'prerequisite' }), /positive safe integer/);
});

test('validates a bounded neighborhood whose graph and list share one payload', () => {
  const nodes = [
    { ref: ref('question', 'q1'), label: 'Question', family: 'structure', state: 'published', canonicalHref: '/questions/q1', createdAt: '2026-08-30T00:00:00Z', createdBy: 'actor-1', isCurrent: true },
    { ref: ref('answer', 'a1'), label: 'Answer', family: 'reasoning', state: 'draft', canonicalHref: '/answers/a1', createdAt: '2026-08-30T00:01:00Z', createdBy: 'actor-1', isCurrent: true },
  ];
  const value = {
    schemaVersion: 'research-neighborhood.v1', requestedRoot: ref('question', 'q1'), resolvedRoot: ref('question', 'q1'), nodes,
    edges: [{ id: 'edge-1', type: 'answers', source: nodes[0].ref, target: nodes[1].ref, family: 'reasoning', forwardLabel: 'answered by', reverseLabel: 'answers', provenanceEventId: 'event-1' }],
    truncated: false, permissionPartial: true, nextCursor: null, graphWatermark: 'commit:8',
  };
  assert.equal(validateResearchNeighborhood(value).edges.length, 1);
  assert.equal(validateResearchNeighborhood(value).permissionPartial, true);
  assert.equal(validateResearchNeighborhood({ ...value, permissionPartial: undefined }).permissionPartial, false);
  assert.throws(() => validateResearchNeighborhood({ ...value, edges: [{ ...value.edges[0], target: ref('answer', 'missing') }] }), /outside the neighborhood/);
});
