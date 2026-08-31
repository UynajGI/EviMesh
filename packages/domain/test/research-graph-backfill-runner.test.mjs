import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RESEARCH_GRAPH_BACKFILL_REPOSITORY_METHODS,
  assertResearchGraphBackfillCutoverReady,
  runResearchGraphBackfill,
} from '../src/research-graph-backfill-runner.mjs';

const SOURCE_METHODS = Object.freeze({
  research_node: 'scanLegacyResearchNodesPage',
  claim_relation: 'scanLegacyClaimRelationsPage',
  evidence_claim_link: 'scanLegacyEvidenceClaimLinksPage',
  challenge_revision: 'scanLegacyChallengeRevisionsPage',
  challenge_impact: 'scanLegacyChallengeImpactsPage',
  task_dependency: 'scanLegacyTaskDependenciesPage',
  run_input: 'scanLegacyRunInputsPage',
  run_output: 'scanLegacyRunOutputsPage',
});

const emptySources = () => Object.fromEntries(Object.keys(SOURCE_METHODS).map((source) => [source, []]));

test('publishes every scanner, checkpoint, audit, and materialization repository port', () => {
  const methods = Object.values(RESEARCH_GRAPH_BACKFILL_REPOSITORY_METHODS).flat();
  for (const method of [
    ...Object.values(SOURCE_METHODS), 'withTransaction', 'listKnownResearchNodeRevisionRefs',
    'getResearchGraphBackfillCheckpoint', 'insertResearchGraphBackfillStaging',
    'insertLegacyRelationRecord', 'insertLegacyNodeRecord', 'insertResearchGraphMigrationFinding',
    'materializeLegacyResearchNode', 'materializeLegacyResearchEdge', 'materializeLegacyResearchMotif', 'materializeLegacyChallengeRevision',
  ]) assert.ok(methods.includes(method), method);
});

function createRepository({ sources = emptySources(), knownRevisionRefs = [], failOnce = null } = {}) {
  const state = {
    checkpoint: null,
    staging: new Map(),
    records: new Map(),
    nodeRecords: new Map(),
    findings: new Map(),
    materialized: [],
    scans: [],
  };
  const repository = {
    state,
    withTransaction: async (callback) => callback(repository),
    listKnownResearchNodeRevisionRefs: async () => knownRevisionRefs,
    getResearchGraphBackfillCheckpoint: async (projectId) => state.checkpoint?.projectId === projectId ? state.checkpoint : null,
    insertResearchGraphBackfillCheckpoint: async (checkpoint) => { state.checkpoint = checkpoint; return checkpoint; },
    updateResearchGraphBackfillCheckpoint: async (checkpoint) => { state.checkpoint = checkpoint; return checkpoint; },
    getResearchGraphBackfillStaging: async (projectId, source, sourceKey) => state.staging.get(`${projectId}:${source}:${sourceKey}`) ?? null,
    insertResearchGraphBackfillStaging: async (staged) => {
      state.staging.set(`${staged.projectId}:${staged.source}:${staged.sourceKey}`, staged);
      return staged;
    },
    listResearchGraphBackfillStaging: async (projectId, source) => [...state.staging.values()].filter((row) => row.projectId === projectId && row.source === source),
    getLegacyRelationRecord: async (source, sourceKey) => state.records.get(`${source}:${sourceKey}`) ?? null,
    insertLegacyRelationRecord: async (record) => {
      state.records.set(`${record.source}:${record.sourceKey}`, record);
      return record;
    },
    getLegacyNodeRecord: async (kind, id, revision) => state.nodeRecords.get(`${kind}:${id}@${revision}`) ?? null,
    insertLegacyNodeRecord: async (record) => {
      state.nodeRecords.set(`${record.sourceKind}:${record.sourceId}@${record.sourceRevision}`, record);
      return record;
    },
    getResearchGraphMigrationFinding: async (findingId) => state.findings.get(findingId) ?? null,
    insertResearchGraphMigrationFinding: async (finding) => {
      if (finding.legacyMappingId && ![...state.records.values()].some((record) => record.mappingId === finding.legacyMappingId)) {
        throw new Error('finding inserted before its legacy mapping');
      }
      state.findings.set(finding.findingId, finding);
      return finding;
    },
    materializeLegacyResearchEdge: async (operation) => { state.materialized.push({ type: 'edge', ...operation }); },
    materializeLegacyResearchNode: async (operation) => { state.materialized.push({ type: 'node', ...operation }); },
    materializeLegacyResearchMotif: async (operation) => { state.materialized.push({ type: 'motif', ...operation }); },
    materializeLegacyChallengeRevision: async (operation) => { state.materialized.push({ type: 'challenge_revision', ...operation }); },
  };
  for (const [source, method] of Object.entries(SOURCE_METHODS)) {
    repository[method] = async ({ cursor, limit }) => {
      state.scans.push({ source, cursor });
      if (failOnce && !failOnce.used && failOnce.source === source && failOnce.cursor === cursor) {
        failOnce.used = true;
        throw new Error('simulated scanner interruption');
      }
      const offset = cursor === null ? 0 : Number(cursor);
      const rows = sources[source].slice(offset, offset + limit);
      const end = offset + rows.length;
      return { rows, nextCursor: end < sources[source].length ? String(end) : null };
    };
  }
  return repository;
}

function completeFixture() {
  const sources = emptySources();
  sources.claim_relation.push({
    relationType: 'extends', sourceClaimId: 'claim-child', sourceRevision: 2,
    targetClaimId: 'claim-parent', targetRevision: 1,
  });
  sources.evidence_claim_link.push({ relationType: 'supports', evidenceId: 'evidence-1', claimId: 'claim-evaluated', claimRevision: 1 });
  sources.challenge_revision.push({ challengeId: 'challenge-1', revision: 1, targetClaimId: 'claim-target', targetClaimRevision: 1 });
  sources.challenge_impact.push({ impactId: 'impact-1', challengeId: 'challenge-1', challengeRevision: 1, claimId: 'claim-impact', claimRevision: 1, impactType: 'scope' });
  sources.task_dependency.push({ sourceTaskId: 'task-dependent', sourceTaskRevision: 2, targetTaskId: 'task-prerequisite', targetTaskRevision: 1 });
  sources.run_input.push({ runId: 'run-1', artifactId: 'artifact-input', artifactRevision: 1 });
  sources.run_output.push({ runId: 'run-1', artifactId: 'artifact-output', artifactRevision: 1 });
  const knownRevisionRefs = [
    { kind: 'claim', id: 'claim-child', revision: 2 },
    { kind: 'claim', id: 'claim-parent', revision: 1 },
    { kind: 'claim', id: 'claim-evaluated', revision: 1 },
    { kind: 'evidence', id: 'evidence-1', revision: 1 },
    { kind: 'claim', id: 'claim-target', revision: 1 },
    { kind: 'claim', id: 'claim-impact', revision: 1 },
    { kind: 'task', id: 'task-dependent', revision: 2 },
    { kind: 'task', id: 'task-prerequisite', revision: 1 },
    { kind: 'run', id: 'run-1', revision: 1 },
    { kind: 'artifact', id: 'artifact-input', revision: 1 },
    { kind: 'artifact', id: 'artifact-output', revision: 1 },
  ];
  return { sources, knownRevisionRefs };
}

test('dry-run scans every raw source in pages and plans explicit forward Challenge, Task, and Run paths without writes', async () => {
  const repository = createRepository(completeFixture());
  const result = await runResearchGraphBackfill({ repository, projectId: 'project-1', pageSize: 1, dryRun: true });

  assert.equal(result.cutoverReady, true);
  assert.equal(result.audit.uniqueSourceCount, 7);
  assert.deepEqual(Object.values(result.plan.sourceCounts), [0, 1, 1, 1, 1, 1, 1, 1]);
  assert.ok(Object.values(result.plan.sourceChecksums).every((checksum) => /^sha256:[0-9a-f]{64}$/.test(checksum)));
  const edges = result.plan.operations.filter((operation) => operation.operation === 'edge').map((operation) => operation.edge);
  assert.ok(edges.some((edge) => edge.type === 'challenges' && edge.source.id === 'claim-target' && edge.target.id === 'challenge-1'));
  assert.ok(edges.some((edge) => edge.type === 'challenges' && edge.source.id === 'claim-impact' && edge.target.id === 'challenge-1'));
  assert.ok(edges.some((edge) => edge.type === 'requires' && edge.source.id === 'task-prerequisite' && edge.target.id === 'task-dependent'));
  assert.ok(edges.some((edge) => edge.type === 'run_input' && edge.source.id === 'artifact-input' && edge.target.id === 'run-1'));
  assert.ok(edges.some((edge) => edge.type === 'produces_artifact' && edge.source.id === 'run-1' && edge.target.id === 'artifact-output'));
  assert.equal(repository.state.checkpoint, null);
  assert.equal(repository.state.staging.size, 0);
  assert.equal(repository.state.records.size, 0);
  assert.equal(repository.state.materialized.length, 0);
});

test('registers typed legacy nodes in normalized topological order before relation materialization', async () => {
  const sources = emptySources();
  const node = (id, statement) => ({
    kind: 'claim', id, revision: 1, projectId: 'project-node-phase',
    createdBy: 'actor_1', stableCreatedBy: 'actor_1', createdAt: '2026-08-31T00:00:00.000Z',
    stableCreatedAt: '2026-08-31T00:00:00.000Z', label: statement, state: 'published',
    canonicalHref: `/claims/${id}`, content: { statement }, sourceEventId: `event_${id}`,
    sourceEventHash: `sha256:${'a'.repeat(64)}`, sourceSignature: { algorithm: 'Ed25519', value: 'preserved' },
    coverageStatus: 'supported', coverageReason: null,
  });
  sources.research_node.push(node('claim-child', 'Child'), node('claim-parent', 'Parent'));
  sources.claim_relation.push({
    relationType: 'extends', sourceClaimId: 'claim-child', sourceRevision: 1,
    targetClaimId: 'claim-parent', targetRevision: 1,
  });
  const repository = createRepository({ sources, knownRevisionRefs: [] });
  const result = await runResearchGraphBackfill({ repository, projectId: 'project-node-phase', pageSize: 1 });
  assert.equal(result.cutoverReady, true);
  assert.deepEqual(result.plan.nodeRegistrations.map((entry) => entry.ref.id), ['claim-parent', 'claim-child']);
  assert.deepEqual(repository.state.materialized.slice(0, 2).map((entry) => `${entry.type}:${entry.registration.ref.id}`), ['node:claim-parent', 'node:claim-child']);
  assert.equal(repository.state.nodeRecords.size, 2);
  assert.equal(repository.state.materialized[2].type, 'edge');
});

test('quarantines typed node rows with missing event evidence instead of silently omitting the source kind', async () => {
  const sources = emptySources();
  sources.research_node.push({
    kind: 'policy_evaluation', id: 'evaluation-no-event', revision: 1, projectId: 'project-node-gap',
    createdBy: null, createdAt: '2026-08-31T00:00:00.000Z', label: 'Legacy policy evaluation',
    canonicalHref: '/policy-evaluations/evaluation-no-event', content: { result: {} }, sourceEventId: null,
    coverageStatus: 'supported',
  });
  const repository = createRepository({ sources });
  const result = await runResearchGraphBackfill({ repository, projectId: 'project-node-gap' });
  assert.equal(result.cutoverReady, false);
  assert.equal([...repository.state.nodeRecords.values()][0].status, 'quarantined');
  assert.ok(result.audit.findings.some((finding) => finding.findingType === 'unmapped_node'));
  assert.equal(repository.state.materialized.filter((entry) => entry.type === 'node').length, 0);
});

test('resumes from the last atomically staged page and a completed repeat invocation is a strict no-op', async () => {
  const sources = emptySources();
  sources.claim_relation.push(
    { relationType: 'extends', sourceClaimId: 'child-1', sourceRevision: 1, targetClaimId: 'root-1', targetRevision: 1 },
    { relationType: 'derived_from', sourceClaimId: 'child-2', sourceRevision: 2, targetClaimId: 'root-2', targetRevision: 1 },
  );
  const knownRevisionRefs = [
    { kind: 'claim', id: 'child-1', revision: 1 }, { kind: 'claim', id: 'root-1', revision: 1 },
    { kind: 'claim', id: 'child-2', revision: 2 }, { kind: 'claim', id: 'root-2', revision: 1 },
  ];
  const failOnce = { source: 'claim_relation', cursor: '1', used: false };
  const repository = createRepository({ sources, knownRevisionRefs, failOnce });

  await assert.rejects(
    runResearchGraphBackfill({ repository, projectId: 'project-resume', pageSize: 1 }),
    /simulated scanner interruption/,
  );
  assert.equal(repository.state.staging.size, 1);
  assert.equal(repository.state.checkpoint.cursors.claim_relation, '1');

  const resumed = await runResearchGraphBackfill({ repository, projectId: 'project-resume', pageSize: 1 });
  assert.equal(resumed.checkpoint.phase, 'complete');
  assert.equal(resumed.plan.sourceCounts.claim_relation, 2);
  assert.equal(resumed.plan.sourceChecksums.claim_relation, resumed.checkpoint.sourceChecksums.claim_relation);
  assert.equal(assertResearchGraphBackfillCutoverReady(resumed), true);
  assert.deepEqual(
    repository.state.scans.filter((scan) => scan.source === 'claim_relation').map((scan) => scan.cursor),
    [null, '1', '1', null, '1'],
  );

  const scansBeforeNoOp = repository.state.scans.length;
  const recordsBeforeNoOp = repository.state.records.size;
  const materializedBeforeNoOp = repository.state.materialized.length;
  const repeated = await runResearchGraphBackfill({ repository, projectId: 'project-resume', pageSize: 1 });
  assert.equal(repeated.noOp, true);
  assert.equal(assertResearchGraphBackfillCutoverReady(repeated), true);
  assert.equal(repository.state.scans.length, scansBeforeNoOp);
  assert.equal(repository.state.records.size, recordsBeforeNoOp);
  assert.equal(repository.state.materialized.length, materializedBeforeNoOp);
});

test('resume revalidates rows behind its durable cursor against the new consistent snapshot', async () => {
  const sources = emptySources();
  sources.claim_relation.push(
    { relationType: 'extends', sourceClaimId: 'child-1', sourceRevision: 1, targetClaimId: 'root-1', targetRevision: 1 },
    { relationType: 'extends', sourceClaimId: 'child-2', sourceRevision: 1, targetClaimId: 'root-2', targetRevision: 1 },
  );
  const knownRevisionRefs = ['child-1', 'root-1', 'child-2', 'root-2'].map((id) => ({ kind: 'claim', id, revision: 1 }));
  const failOnce = { source: 'claim_relation', cursor: '1', used: false };
  const repository = createRepository({ sources, knownRevisionRefs, failOnce });
  await assert.rejects(runResearchGraphBackfill({ repository, projectId: 'project-changing', pageSize: 1 }), /simulated scanner interruption/);
  sources.claim_relation[0] = { ...sources.claim_relation[0], relationType: 'derived_from' };
  await assert.rejects(
    runResearchGraphBackfill({ repository, projectId: 'project-changing', pageSize: 1 }),
    (error) => error.code === 'RESEARCH_GRAPH_BACKFILL_SOURCE_CONFLICT',
  );
  assert.equal(repository.state.records.size, 0);
});

test('fails closed when durable source count/checksum parity no longer matches staging', async () => {
  const repository = createRepository(completeFixture());
  const complete = await runResearchGraphBackfill({ repository, projectId: 'project-parity', pageSize: 2 });
  assert.equal(complete.checkpoint.phase, 'complete');
  assert.equal(repository.state.records.size, 7);
  assert.ok(repository.state.materialized.some((operation) => operation.type === 'edge'));
  assert.ok(repository.state.materialized.some((operation) => operation.type === 'motif'));
  assert.ok(repository.state.materialized.some((operation) => operation.type === 'challenge_revision'));
  repository.state.checkpoint = {
    ...complete.checkpoint,
    phase: 'applying',
    completedAt: null,
    sourceCounts: { ...complete.checkpoint.sourceCounts, claim_relation: 999 },
  };
  await assert.rejects(
    runResearchGraphBackfill({ repository, projectId: 'project-parity', pageSize: 2 }),
    (error) => error.code === 'RESEARCH_GRAPH_BACKFILL_PARITY_MISMATCH',
  );
});

test('archives unmapped rows and blocks cutover instead of inventing missing revision anchors', async () => {
  const sources = emptySources();
  sources.claim_relation.push({ relationType: 'extends', sourceClaimId: 'claim-a', targetClaimId: 'claim-b' });
  const repository = createRepository({ sources, knownRevisionRefs: [] });
  const result = await runResearchGraphBackfill({ repository, projectId: 'project-unmapped' });

  assert.equal(result.checkpoint.phase, 'blocked');
  assert.equal(result.cutoverReady, false);
  assert.equal([...repository.state.records.values()][0].status, 'quarantined');
  assert.ok([...repository.state.findings.values()].some((finding) => finding.findingType === 'unmapped_relation' && finding.status === 'active'));
  assert.equal(repository.state.materialized.length, 0);
  assert.throws(() => assertResearchGraphBackfillCutoverReady(result), (error) => error.code === 'RESEARCH_GRAPH_CUTOVER_BLOCKED');
});

test('rejects non-JSON scanner values instead of silently changing provenance timestamps or bytes', async () => {
  const sources = emptySources();
  sources.claim_relation.push({
    relationType: 'extends', sourceClaimId: 'claim-a', sourceRevision: 1,
    targetClaimId: 'claim-b', targetRevision: 1, createdAt: new Date('2026-08-31T00:00:00Z'),
  });
  const repository = createRepository({ sources, knownRevisionRefs: [] });
  await assert.rejects(
    runResearchGraphBackfill({ repository, projectId: 'project-json', dryRun: true }),
    /scanner must encode dates and binary signature bytes explicitly/,
  );
});

test('quarantines dangling exact revisions and blocks cutover without leaking them into formal edges', async () => {
  const sources = emptySources();
  sources.task_dependency.push({ sourceTaskId: 'dependent', sourceTaskRevision: 2, targetTaskId: 'missing-prerequisite', targetTaskRevision: 1 });
  const repository = createRepository({ sources, knownRevisionRefs: [{ kind: 'task', id: 'dependent', revision: 2 }] });
  const result = await runResearchGraphBackfill({ repository, projectId: 'project-orphan' });

  assert.equal(result.checkpoint.phase, 'blocked');
  assert.ok(result.audit.findings.some((finding) => finding.findingType === 'dangling_revision'));
  assert.ok(result.audit.records.every((record) => record.status === 'quarantined'));
  assert.equal(repository.state.materialized.length, 0);
});

test('does not treat a Challenge revision as planned when its exact target Claim is missing', async () => {
  const sources = emptySources();
  sources.challenge_revision.push({ challengeId: 'challenge-orphan', revision: 1, targetClaimId: 'missing-target', targetClaimRevision: 3 });
  sources.challenge_impact.push({ impactId: 'impact-orphan', challengeId: 'challenge-orphan', challengeRevision: 1, claimId: 'known-impact', claimRevision: 1, impactType: 'scope' });
  const repository = createRepository({ sources, knownRevisionRefs: [{ kind: 'claim', id: 'known-impact', revision: 1 }] });
  const result = await runResearchGraphBackfill({ repository, projectId: 'project-challenge-orphan' });

  assert.equal(result.checkpoint.phase, 'blocked');
  assert.equal(result.audit.records.filter((record) => record.status === 'quarantined').length, 2);
  assert.ok(result.audit.findings.some((finding) => finding.memberRefs.includes('claim:missing-target@3')));
  assert.ok(result.audit.findings.some((finding) => finding.memberRefs.includes('challenge:challenge-orphan@1')));
  assert.equal(repository.state.materialized.length, 0);
});

test('applies Challenge lineage in numeric revision order and quarantines skipped revisions before SQL apply', async () => {
  const { sources, knownRevisionRefs } = { sources: emptySources(), knownRevisionRefs: [{ kind: 'claim', id: 'claim-target', revision: 1 }] };
  for (let revision = 10; revision >= 1; revision -= 1) {
    sources.challenge_revision.push({ challengeId: 'challenge-many', revision, targetClaimId: 'claim-target', targetClaimRevision: 1 });
  }
  const repository = createRepository({ sources, knownRevisionRefs });
  const result = await runResearchGraphBackfill({ repository, projectId: 'project-challenge-order' });
  assert.equal(result.cutoverReady, true);
  assert.deepEqual(
    repository.state.materialized.filter((entry) => entry.type === 'challenge_revision').map((entry) => entry.ref.revision),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );

  const skippedSources = emptySources();
  skippedSources.challenge_revision.push(
    { challengeId: 'challenge-skip', revision: 1, targetClaimId: 'claim-target', targetClaimRevision: 1 },
    { challengeId: 'challenge-skip', revision: 3, targetClaimId: 'claim-target', targetClaimRevision: 1 },
  );
  const skippedRepository = createRepository({ sources: skippedSources, knownRevisionRefs });
  const skipped = await runResearchGraphBackfill({ repository: skippedRepository, projectId: 'project-challenge-skip' });
  assert.equal(skipped.cutoverReady, false);
  assert.ok(skipped.audit.findings.some((finding) => finding.findingType === 'dangling_revision'));
  assert.deepEqual(
    skippedRepository.state.materialized.filter((entry) => entry.type === 'challenge_revision').map((entry) => entry.ref.revision),
    [1],
  );
});
