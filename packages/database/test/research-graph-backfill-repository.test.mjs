import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LEGACY_RESEARCH_NODE_SCANNER_COVERAGE,
  RESEARCH_GRAPH_BACKFILL_SQL,
  ResearchGraphBackfillRepositoryError,
  createPostgresResearchGraphBackfillRepository,
} from '../src/research-graph-backfill-repository.mjs';
import {
  parseResearchGraphBackfillArgs,
  runResearchGraphBackfillEntrypoint,
} from '../src/research-graph-backfill-entrypoint.mjs';
import { RESEARCH_NODE_KINDS } from '../../protocol/src/research-graph.mjs';

function fakePostgres({ rowsFor = () => [] } = {}) {
  const calls = [];
  const tx = {
    async unsafe(query, parameters = []) {
      calls.push({ query, parameters });
      if (/current_role::text/.test(query)) return [{ currentRole: 'service_role' }];
      if (/pg_export_snapshot/.test(query)) return [{ snapshotId: '00000003-0000001b-1' }];
      return rowsFor(query, parameters);
    },
  };
  const sql = function sql() {};
  sql.begin = async (options, callback) => {
    calls.push({ begin: options });
    return callback(tx);
  };
  sql.end = async () => {};
  return { sql, calls };
}

test('service-only scanner uses a bounded keyset page and preserves absent Claim revisions', async () => {
  const { sql, calls } = fakePostgres({
    rowsFor(query) {
      if (!query.includes('FROM public.claim_relations')) return [];
      return [
        { scan_key: 'a', sourceClaimId: 'claim_a', sourceRevision: null, targetClaimId: 'claim_b', targetRevision: null, relationType: 'depends_on', createdAt: new Date('2026-08-01T00:00:00Z') },
        { scan_key: 'b', sourceClaimId: 'claim_c', sourceRevision: null, targetClaimId: 'claim_d', targetRevision: null, relationType: 'extends' },
      ];
    },
  });
  const repository = createPostgresResearchGraphBackfillRepository({ sql });
  const page = await repository.scanLegacyClaimRelationsPage({ projectId: 'project_1', limit: 1 });
  assert.equal(page.rows.length, 1);
  assert.equal(page.rows[0].sourceRevision, null);
  assert.equal(page.rows[0].createdAt, '2026-08-01T00:00:00.000Z');
  assert.ok(page.nextCursor);
  assert.ok(calls.some((call) => call.query === 'SET LOCAL ROLE service_role'));
  assert.ok(calls.some((call) => call.begin === 'ISOLATION LEVEL REPEATABLE READ READ ONLY'));
  const scan = calls.find((call) => call.query?.includes('FROM public.claim_relations'));
  assert.deepEqual(scan.parameters, ['project_1', '', 2]);
});

test('legacy Claim and Task scanners never infer a current or revision-1 anchor', () => {
  for (const source of ['claim_relation', 'task_dependency']) {
    const query = RESEARCH_GRAPH_BACKFILL_SQL.scanners[source];
    assert.match(query, /NULL::integer AS "(?:source|target)(?:Task)?Revision"/);
    assert.doesNotMatch(query, /max\s*\(\s*revision/i);
    assert.doesNotMatch(query, /is_current/i);
  }
});

test('node registration scanner declares every formal kind and emits explicit unsupported coverage rows', () => {
  assert.deepEqual(Object.keys(LEGACY_RESEARCH_NODE_SCANNER_COVERAGE).sort(), [...RESEARCH_NODE_KINDS].sort());
  for (const kind of ['answer', 'rebuttal', 'evaluation', 'dataset', 'tool']) {
    assert.equal(LEGACY_RESEARCH_NODE_SCANNER_COVERAGE[kind].status, 'not_applicable');
  }
  const query = RESEARCH_GRAPH_BACKFILL_SQL.scanners.research_node;
  for (const table of [
    'project_revisions', 'question_revisions', 'task_revisions', 'claim_revisions', 'artifact_revisions',
    'attempts', 'context_bundles', 'runs', 'evidence', 'verification_contract_revisions',
    'verification_policy_revisions', 'policy_evaluations', 'verification_receipts',
    'verification_findings', 'challenge_revisions', 'merge_proposals', 'frontier_snapshots',
  ]) assert.match(query, new RegExp(`public\\.${table}`));
  assert.match(query, /coverage_status/);
  assert.match(query, /'unsupported'/);
  assert.match(query, /unscoped_or_shared_count/);
  assert.doesNotMatch(query, /max\s*\(\s*revision/i);
  assert.doesNotMatch(query, /is_current/i);
});

test('consistent snapshot stays open while readers import the exported snapshot', async () => {
  const { sql, calls } = fakePostgres();
  const repository = createPostgresResearchGraphBackfillRepository({ sql });
  await repository.withConsistentSnapshot(async (snapshotRepository) => {
    await snapshotRepository.listKnownResearchNodeRevisionRefs({ projectId: 'project_1' });
  });
  assert.ok(calls.some((call) => call.query === "SET TRANSACTION SNAPSHOT '00000003-0000001b-1'"));
  assert.equal(calls.filter((call) => call.query === 'SET LOCAL ROLE service_role').length, 2);
});

test('repository rejects clients that cannot establish explicit transactions', () => {
  assert.throws(
    () => createPostgresResearchGraphBackfillRepository({ sql: {} }),
    (error) => error instanceof ResearchGraphBackfillRepositoryError,
  );
});

test('formal direct edges bind the immutable target revision event and author without fabricating provenance', async () => {
  const { sql, calls } = fakePostgres({
    rowsFor(query, parameters) {
      if (query.includes('FROM private.research_node_revisions AS revision')) {
        const isSource = parameters[1] === 'claim_source';
        return [{
          kind: 'claim', id: parameters[1], revision: 1,
          commitRank: isSource ? '2' : '4', batchRank: 1,
          sourceEventId: isSource ? 'source-event' : 'target-event',
          createdBy: isSource ? 'actor_source' : 'actor_target',
          createdAt: '2026-08-01T00:00:00.000Z', projectId: 'project_1',
        }];
      }
      if (query.includes('INSERT INTO private.research_edges')) return [{ edgeId: parameters[0] }];
      return [];
    },
  });
  const repository = createPostgresResearchGraphBackfillRepository({ sql });
  const edge = {
    type: 'extends',
    source: { kind: 'claim', id: 'claim_source', revision: 1 },
    target: { kind: 'claim', id: 'claim_target', revision: 1 },
  };
  await repository.materializeLegacyResearchEdge({
    record: { projectId: 'project_1', source: 'claim_relation', sourceKey: 'legacy', sourcePayload: { createdBy: 'actor_target', createdAt: '2026-08-02T00:00:00Z' } },
    edgeId: 'edge_1', edge,
  });
  const insert = calls.find((call) => call.query?.includes('INSERT INTO private.research_edges'));
  assert.equal(insert.parameters[12], 'target-event');
  assert.equal(insert.parameters[13], 'actor_target');
  assert.ok(calls.some((call) => call.begin === 'ISOLATION LEVEL SERIALIZABLE'));
});

test('Evaluation motif SQL persists a strong subtype, exact bases, and complete incoming edges', async () => {
  const { sql, calls } = fakePostgres({
    rowsFor(query, parameters) {
      if (query.includes('FROM public.research_events WHERE event_id')) return [{ eventId: 'event_1', actorId: 'actor_1', createdAt: '2026-08-01T00:00:00Z' }];
      if (query.includes('FROM private.research_node_revisions AS revision')) {
        return [{ kind: parameters[0], id: parameters[1], revision: parameters[2], commitRank: parameters[0] === 'claim' ? '2' : '3', batchRank: 1, sourceEventId: 'old', createdBy: 'actor_old', createdAt: '2026-07-01T00:00:00Z', projectId: 'project_1' }];
      }
      if (query.includes('INSERT INTO private.research_nodes')) return [{ nodeId: parameters[0] }];
      if (query.includes('INSERT INTO private.research_node_revisions')) return [{ kind: 'evaluation', id: parameters[1], revision: 1, commitRank: '10', batchRank: 1, sourceEventId: 'event_1', createdBy: 'actor_1', createdAt: '2026-08-01T00:00:00Z' }];
      if (query.includes('INSERT INTO private.research_edges')) return [{ edgeId: parameters[0] }];
      return [];
    },
  });
  const repository = createPostgresResearchGraphBackfillRepository({ sql });
  await repository.materializeLegacyResearchMotif({
    record: {
      mappingId: 'mapping_1', projectId: 'project_1', source: 'evidence_claim_link', sourceKey: 'legacy',
      sourceChecksum: `sha256:${'a'.repeat(64)}`,
      sourcePayload: { provenanceEventId: 'event_1', createdBy: 'actor_1', createdAt: '2026-08-01T00:00:00Z' },
    },
    operation: {
      motifType: 'evaluation', node: { kind: 'evaluation', id: 'evaluation_1', revision: 1 }, stance: 'supports',
      subject: { kind: 'claim', id: 'claim_1', revision: 1 },
      bases: [{ kind: 'evidence', id: 'evidence_1', revision: 1 }],
    },
  });
  assert.ok(calls.some((call) => call.query?.includes('INSERT INTO private.evaluation_revisions')));
  assert.ok(calls.some((call) => call.query?.includes('INSERT INTO private.evaluation_bases')));
  assert.equal(calls.filter((call) => call.query?.includes('INSERT INTO private.research_edges')).length, 2);
});

test('Challenge revision 2 requires exact prior lineage and adds its supersedes edge in the same transaction', async () => {
  const { sql, calls } = fakePostgres({
    rowsFor(query, parameters) {
      if (query.includes('FROM public.research_events WHERE event_id')) return [{ eventId: 'event_2', actorId: 'actor_1', createdAt: '2026-08-02T00:00:00Z' }];
      if (query.includes("SELECT node_id FROM private.research_nodes WHERE node_kind='challenge'")) return [{ node_id: 'challenge_1' }];
      if (query.includes('FROM private.research_node_revisions AS revision')) return [{ kind: 'challenge', id: 'challenge_1', revision: 1, commitRank: '5', batchRank: 1, sourceEventId: 'event_1', createdBy: 'actor_1', createdAt: '2026-08-01T00:00:00Z', canonicalContentHash: `sha256:${'b'.repeat(64)}`, projectId: 'project_1' }];
      if (query.includes('INSERT INTO private.research_node_revisions')) return [{ kind: 'challenge', id: 'challenge_1', revision: 2, commitRank: '8', batchRank: 1, sourceEventId: 'event_2', createdBy: 'actor_1', createdAt: '2026-08-02T00:00:00Z' }];
      if (query.includes('INSERT INTO private.research_edges')) return [{ edgeId: parameters[0] }];
      return [];
    },
  });
  const repository = createPostgresResearchGraphBackfillRepository({ sql });
  await repository.materializeLegacyChallengeRevision({
    record: {
      mappingId: 'mapping_challenge_2', projectId: 'project_1', source: 'challenge_revision', sourceKey: 'challenge_1@2',
      sourceChecksum: `sha256:${'c'.repeat(64)}`,
      sourcePayload: {
        provenanceEventId: 'event_2', createdBy: 'actor_1', createdAt: '2026-08-02T00:00:00Z',
        state: 'investigating', reason: 'Exact legacy reason', impact: {},
        targetClaimId: 'claim_1', targetClaimRevision: 1,
      },
    },
    ref: { kind: 'challenge', id: 'challenge_1', revision: 2 },
  });
  const revisionInsert = calls.find((call) => call.query?.includes('INSERT INTO private.research_node_revisions'));
  assert.equal(revisionInsert.parameters[2], 1);
  const lineage = calls.find((call) => call.query?.includes('INSERT INTO private.research_edges'));
  assert.equal(lineage.parameters[1], 'supersedes');
  assert.equal(lineage.parameters[12], 'event_2');
});

test('node registration preserves rev1 and rev2 identity and creates exact lineage once', async () => {
  let rank = 1;
  const revisions = new Map();
  const nodes = new Map();
  const { sql, calls } = fakePostgres({
    rowsFor(query, parameters) {
      if (query.includes('FROM public.research_events WHERE event_id')) {
        return [{ eventId: parameters[0], actorId: 'actor_1', createdAt: parameters[0] === 'event_1' ? '2026-08-01T00:00:00Z' : '2026-08-02T00:00:00Z' }];
      }
      if (query.includes('INSERT INTO private.research_nodes')) {
        const key = parameters[0];
        if (nodes.has(key)) return [];
        nodes.set(key, { nodeId: key });
        return [{ nodeId: key }];
      }
      if (query.includes('SELECT node_id FROM private.research_nodes')) return nodes.has(parameters[0]) ? [{ node_id: parameters[0] }] : [];
      if (query.includes('INSERT INTO private.research_node_revisions')) {
        const key = `${parameters[0]}:${parameters[1]}@${parameters[2]}`;
        if (revisions.has(key)) return [];
        const row = {
          kind: parameters[0], id: parameters[1], revision: parameters[2], supersedesRevision: parameters[3],
          commitRank: String(rank++), batchRank: 1, canonicalContentHash: parameters[4], label: parameters[5],
          state: parameters[6], canonicalHref: parameters[7], sourceEventId: parameters[8], createdBy: parameters[9],
          createdAt: parameters[10], projectId: 'project_1',
        };
        revisions.set(key, row);
        return [row];
      }
      if (query.includes('FROM private.research_node_revisions AS revision')) {
        const row = revisions.get(`${parameters[0]}:${parameters[1]}@${parameters[2]}`);
        return row ? [row] : [];
      }
      if (query.includes('INSERT INTO private.research_edges')) return [{ edgeId: parameters[0] }];
      return [];
    },
  });
  const repository = createPostgresResearchGraphBackfillRepository({ sql });
  const base = {
    projectId: 'project_1', source: 'research_node', sourceChecksum: `sha256:${'d'.repeat(64)}`,
    sourceEventId: 'event_1', sourcePayload: { createdBy: 'actor_1', sourceEventId: 'event_1' },
  };
  const common = {
    projectId: 'project_1', canonicalContentHash: `sha256:${'e'.repeat(64)}`, label: 'Claim', state: 'published',
    canonicalHref: '/claims/claim_1', createdBy: 'actor_1', stableCreatedBy: 'actor_1',
    stableCreatedAt: '2026-08-01T00:00:00Z', retiredAt: null,
  };
  await repository.materializeLegacyResearchNode({
    record: { ...base, sourceKey: 'claim:claim_1@1' },
    registration: { ...common, ref: { kind: 'claim', id: 'claim_1', revision: 1 }, supersedesRevision: null, sourceEventId: 'event_1', createdAt: '2026-08-01T00:00:00Z' },
  });
  await repository.materializeLegacyResearchNode({
    record: { ...base, sourceKey: 'claim:claim_1@2', sourceEventId: 'event_2', sourcePayload: { createdBy: 'actor_1', sourceEventId: 'event_2' } },
    registration: { ...common, ref: { kind: 'claim', id: 'claim_1', revision: 2 }, supersedesRevision: 1, sourceEventId: 'event_2', createdAt: '2026-08-02T00:00:00Z' },
  });
  assert.equal(nodes.size, 1);
  assert.equal(revisions.size, 2);
  const lineage = calls.filter((call) => call.query?.includes('INSERT INTO private.research_edges'));
  assert.equal(lineage.length, 1);
  assert.equal(lineage[0].parameters[1], 'supersedes');
  assert.deepEqual(lineage[0].parameters.slice(2, 10), ['claim', 'claim_1', 1, '1', 1, 'claim', 'claim_1', 2]);
});

test('entrypoint parser is dry-run by default and requires explicit apply', () => {
  assert.deepEqual(parseResearchGraphBackfillArgs(['--project', 'project_1']), {
    projectId: 'project_1', pageSize: 100, dryRun: true, help: false,
  });
  assert.deepEqual(parseResearchGraphBackfillArgs(['--project=project_1', '--page-size=25', '--apply']), {
    projectId: 'project_1', pageSize: 25, dryRun: false, help: false,
  });
  assert.throws(() => parseResearchGraphBackfillArgs(['--apply']), /--project is required/);
  assert.throws(() => parseResearchGraphBackfillArgs(['--project', 'p', '--page-size', '0']), /1 to 1000/);
});

test('package entrypoint injects snapshot repository, emits a redacted summary, and closes SQL', async () => {
  let ended = false;
  const sql = function sql() {};
  sql.end = async () => { ended = true; };
  const writes = [];
  const result = await runResearchGraphBackfillEntrypoint({
    argv: ['--project', 'project_1'],
    env: { DATABASE_URL: 'postgres://example.invalid/db' },
    output: { write(value) { writes.push(value); } },
    createSql: () => sql,
    createRepository: () => ({ withConsistentSnapshot: (callback) => callback({ snapshot: true }) }),
    runBackfill: async ({ repository, dryRun, projectId }) => {
      assert.equal(repository.snapshot, true);
      assert.equal(dryRun, true);
      assert.equal(projectId, 'project_1');
      return { dryRun: true, noOp: false, cutoverReady: false, audit: { findings: [{ details: 'private' }], records: [] }, plan: { planChecksum: 'sha256:test', sourceCounts: { claim_relation: 1 } } };
    },
  });
  assert.equal(result.exitCode, 2);
  assert.equal(ended, true);
  assert.match(writes.join(''), /"mode": "dry-run"/);
  assert.doesNotMatch(writes.join(''), /private/);
});
