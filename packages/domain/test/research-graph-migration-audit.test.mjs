import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertResearchGraphCutoverReady,
  auditLegacyResearchGraph,
  persistLegacyResearchGraphAudit,
} from '../src/research-graph-migration-audit.mjs';

const claimTypes = ['depends_on', 'supports', 'refutes', 'qualifies', 'reproduces', 'extends', 'supersedes', 'contradicts', 'derived_from', 'uses_method', 'uses_dataset', 'implements', 'verifies', 'challenges'];
const evidenceTypes = ['supports', 'refutes', 'qualifies', 'reproduces'];

test('audits all 14 Claim and 4 Evidence relations with deterministic exact coverage', () => {
  const input = {
    projectId: 'project-1',
    claimRelations: claimTypes.map((relationType, index) => ({ relationType, sourceClaimId: `source-${index}`, sourceRevision: 1, targetClaimId: `target-${index}`, targetRevision: 1 })),
    evidenceClaimLinks: evidenceTypes.map((relationType, index) => ({ relationType, evidenceId: `evidence-${index}`, claimId: `claim-${index}`, claimRevision: 2 })),
  };
  const first = auditLegacyResearchGraph(input);
  const second = auditLegacyResearchGraph(input);
  assert.equal(first.sourceCount, 18);
  assert.equal(first.uniqueSourceCount, 18);
  assert.deepEqual(first, second);
  assert.equal(new Set(first.records.map((record) => record.mappingId)).size, 18);
  assert.equal(first.findings.length, 0);
  assert.equal(assertResearchGraphCutoverReady({ audit: first, expectedUniqueSourceCount: 18 }), true);
});

test('keeps reversible source payloads and archives soft-deleted relations without silently dropping them', () => {
  const deleted = {
    relationType: 'extends', sourceClaimId: 'old-source', sourceRevision: 1, targetClaimId: 'old-target', targetRevision: 1,
    createdBy: 'actor-original', createdAt: '2025-01-02T03:04:05Z', deletedAt: '2025-02-03T04:05:06Z',
  };
  const audit = auditLegacyResearchGraph({ projectId: 'project-1', claimRelations: [deleted] });
  assert.equal(audit.sourceCount, 1);
  assert.equal(audit.uniqueSourceCount, 1);
  assert.equal(audit.records[0].mappingKind, 'archive');
  assert.equal(audit.records[0].status, 'archived');
  assert.deepEqual(audit.records[0].sourcePayload, deleted);
  assert.equal(audit.findings.length, 0);
  assert.equal(assertResearchGraphCutoverReady({ audit, expectedUniqueSourceCount: 1 }), true);
});

test('quarantines an entire strongly connected group without deleting or reversing one edge', () => {
  const audit = auditLegacyResearchGraph({
    projectId: 'project-1',
    claimRelations: [
      { relationType: 'depends_on', sourceClaimId: 'a', sourceRevision: 1, targetClaimId: 'b', targetRevision: 1 },
      { relationType: 'depends_on', sourceClaimId: 'b', sourceRevision: 1, targetClaimId: 'c', targetRevision: 1 },
      { relationType: 'depends_on', sourceClaimId: 'c', sourceRevision: 1, targetClaimId: 'a', targetRevision: 1 },
      { relationType: 'extends', sourceClaimId: 'outside', sourceRevision: 1, targetClaimId: 'root', targetRevision: 1 },
    ],
  });
  assert.equal(audit.findings.filter((finding) => finding.findingType === 'cycle').length, 1);
  assert.equal(audit.records.filter((record) => record.status === 'quarantined').length, 3);
  assert.equal(audit.records.filter((record) => record.status === 'mapped').length, 1);
  assert.throws(() => assertResearchGraphCutoverReady({ audit }), (error) => error.code === 'RESEARCH_GRAPH_CUTOVER_BLOCKED');
});

test('reports self-loops, dangling revisions, and same-Artifact Run I/O overlap', () => {
  const audit = auditLegacyResearchGraph({
    projectId: 'project-1',
    claimRelations: [{ relationType: 'extends', sourceClaimId: 'same', sourceRevision: 1, targetClaimId: 'same', targetRevision: 1 }],
    knownRevisionRefs: [],
    runInputs: [{ runId: 'run-1', artifactId: 'artifact-1', artifactRevision: 1 }],
    runOutputs: [{ runId: 'run-1', artifactId: 'artifact-1', artifactRevision: 1 }],
  });
  assert.deepEqual(new Set(audit.findings.map((finding) => finding.findingType)), new Set(['cycle', 'self_loop', 'dangling_revision', 'run_io_overlap']));
  assert.equal(audit.records[0].mappingKind, 'archive');
});

test('audits Challenge revisions and impacts, Task prerequisites, and Run input/output paths', () => {
  const knownRevisionRefs = [
    { kind: 'claim', id: 'claim-target', revision: 2 },
    { kind: 'claim', id: 'claim-impact', revision: 3 },
    { kind: 'challenge', id: 'challenge-1', revision: 1 },
    { kind: 'task', id: 'dependent', revision: 4 },
    { kind: 'task', id: 'prerequisite', revision: 2 },
    { kind: 'run', id: 'run-1', revision: 1 },
    { kind: 'artifact', id: 'input', revision: 5 },
    { kind: 'artifact', id: 'output', revision: 6 },
  ];
  const audit = auditLegacyResearchGraph({
    projectId: 'project-1', knownRevisionRefs,
    challengeRevisions: [{ challengeId: 'challenge-1', revision: 1, targetClaimId: 'claim-target', targetClaimRevision: 2 }],
    challengeImpacts: [{ impactId: 'impact-1', challengeId: 'challenge-1', challengeRevision: 1, claimId: 'claim-impact', claimRevision: 3, impactType: 'scope' }],
    taskDependencies: [{ sourceTaskId: 'dependent', sourceTaskRevision: 4, targetTaskId: 'prerequisite', targetTaskRevision: 2 }],
    runInputs: [{ runId: 'run-1', artifactId: 'input', artifactRevision: 5 }],
    runOutputs: [{ runId: 'run-1', artifactId: 'output', artifactRevision: 6 }],
  });
  assert.equal(audit.sourceCount, 5);
  assert.deepEqual(audit.records.map((record) => record.source), ['challenge_impact', 'challenge_revision', 'run_input', 'run_output', 'task_dependency']);
  assert.deepEqual(audit.records.map((record) => record.motif.edge.type).sort(), ['challenges', 'challenges', 'produces_artifact', 'requires', 'run_input']);
  assert.equal(audit.findings.length, 0);
  assert.equal(assertResearchGraphCutoverReady({ audit, expectedUniqueSourceCount: 5 }), true);
});

test('persists deterministic records and findings idempotently and rejects changed checksums', async () => {
  const audit = auditLegacyResearchGraph({ projectId: 'project-1', claimRelations: [{ relationType: 'supports', sourceClaimId: 'a', sourceRevision: 1, targetClaimId: 'b', targetRevision: 1 }] });
  const records = new Map();
  const findings = new Map();
  const repository = {
    withTransaction: (callback) => callback(repository),
    getLegacyRelationRecord: async (source, sourceKey) => records.get(`${source}:${sourceKey}`) ?? null,
    insertLegacyRelationRecord: async (record) => { records.set(`${record.source}:${record.sourceKey}`, record); return record; },
    getResearchGraphMigrationFinding: async (id) => findings.get(id) ?? null,
    insertResearchGraphMigrationFinding: async (finding) => { findings.set(finding.findingId, finding); return finding; },
  };
  const first = await persistLegacyResearchGraphAudit({ repository, audit });
  const second = await persistLegacyResearchGraphAudit({ repository, audit });
  assert.deepEqual(first, second);
  const stored = records.values().next().value;
  stored.sourceChecksum = `sha256:${'0'.repeat(64)}`;
  await assert.rejects(persistLegacyResearchGraphAudit({ repository, audit }), (error) => error.code === 'LEGACY_RELATION_CONFLICT');
});
