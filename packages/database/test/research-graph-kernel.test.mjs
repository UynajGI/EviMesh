import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  answerRevisions,
  datasetRevisions,
  evaluationBases,
  evaluationRevisions,
  legacyNodeRecords,
  legacyRelationSource,
  legacyRelationRecords,
  rebuttalRevisions,
  researchEdges,
  researchEdgeType,
  researchGraphMigrationFindings,
  researchGraphBackfillCheckpoints,
  researchGraphBackfillStaging,
  researchNodeKind,
  researchNodeRevisions,
  researchNodes,
  toolRevisions,
} from '../src/research-graph.mjs';

const migration = await readFile(new URL('../drizzle/0080_rare_killmonger.sql', import.meta.url), 'utf8');
const backfillMigration = await readFile(new URL('../drizzle/0081_tricky_the_hand.sql', import.meta.url), 'utf8');
const nodeBackfillMigration = await readFile(new URL('../drizzle/0082_optimal_terrax.sql', import.meta.url), 'utf8');

test('revokes default PUBLIC function execution before creating private kernel helpers', () => {
  const revokeDefaults = migration.indexOf('ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC');
  const firstPrivateFunction = migration.indexOf('CREATE OR REPLACE FUNCTION private.');
  assert.ok(revokeDefaults > 0);
  assert.ok(firstPrivateFunction > revokeDefaults);
});

test('defines private stable nodes, immutable revision vertices, and ranked edges', () => {
  assert.equal(researchNodes[Symbol.for('drizzle:Schema')], 'private');
  assert.equal(researchNodeRevisions[Symbol.for('drizzle:Schema')], 'private');
  assert.equal(researchEdges[Symbol.for('drizzle:Schema')], 'private');
  assert.ok(researchNodeKind.enumValues.includes('answer'));
  assert.ok(researchNodeKind.enumValues.includes('evaluation'));
  for (const relation of ['materializes_evidence', 'verifies_claim', 'verifies_run', 'uses_verification_contract', 'reports_finding']) {
    assert.ok(researchEdgeType.enumValues.includes(relation));
  }
  const revisionColumns = getTableColumns(researchNodeRevisions);
  assert.deepEqual(
    getTableConfig(researchNodeRevisions).primaryKeys[0].columns.map((column) => column.name),
    ['node_kind', 'node_id', 'revision'],
  );
  for (const column of ['commitRank', 'batchRank', 'canonicalContentHash', 'sourceEventId']) assert.equal(revisionColumns[column].notNull, true);
  const edgeConfig = getTableConfig(researchEdges);
  assert.equal(edgeConfig.foreignKeys.length, 4);
  assert.ok(edgeConfig.checks.some((constraint) => constraint.name === 'research_edges_forward_rank'));
});

test('keeps new semantic content in five strong subtype projections', () => {
  const tables = [answerRevisions, rebuttalRevisions, evaluationRevisions, datasetRevisions, toolRevisions];
  for (const table of tables) {
    const config = getTableConfig(table);
    assert.equal(config.schema, 'private');
    assert.equal(config.primaryKeys.length, 1);
    assert.ok(config.foreignKeys.some((foreignKey) => foreignKey.reference().foreignTable === researchNodeRevisions));
  }
  assert.equal(getTableConfig(evaluationBases).foreignKeys.length, 2);
  assert.equal(getTableColumns(evaluationRevisions).stance.notNull, true);
  assert.equal(getTableColumns(datasetRevisions).artifactRevision.notNull, true);
  assert.equal(getTableColumns(toolRevisions).toolKind.notNull, true);
});

test('provides append-only, idempotent legacy crosswalk and blocking finding primitives', () => {
  assert.ok(getTableConfig(legacyRelationRecords).indexes.some((entry) => entry.config.unique));
  assert.equal(getTableColumns(legacyRelationRecords).sourceChecksum.notNull, true);
  assert.equal(getTableColumns(researchGraphMigrationFindings).severity.notNull, true);
  assert.match(migration, /legacy_relation_records_append_only_trigger/);
  assert.match(migration, /research_graph_migration_findings_project_status_idx/);
});

test('provides an immutable typed-revision crosswalk for node registration', () => {
  const config = getTableConfig(legacyNodeRecords);
  const columns = getTableColumns(legacyNodeRecords);
  assert.equal(config.schema, 'private');
  assert.ok(config.indexes.some((entry) => entry.config.unique));
  assert.equal(columns.sourceKind.notNull, true);
  assert.equal(columns.sourceRevision.notNull, true);
  assert.equal(columns.sourceChecksum.notNull, true);
  assert.equal(columns.sourceEventId.notNull, false);
  assert.equal(getTableColumns(researchGraphMigrationFindings).legacyNodeMappingId.notNull, false);
  assert.ok(legacyRelationSource.enumValues.includes('research_node'));
  assert.match(nodeBackfillMigration, /legacy_node_records_append_only_trigger/);
  assert.match(nodeBackfillMigration, /ALTER TABLE private\.legacy_node_records ENABLE ROW LEVEL SECURITY/);
  assert.match(nodeBackfillMigration, /REVOKE ALL ON TABLE private\.legacy_node_records FROM anon/);
  assert.match(nodeBackfillMigration, /REVOKE ALL ON TABLE private\.legacy_node_records FROM authenticated/);
  assert.match(nodeBackfillMigration, /GRANT SELECT, INSERT ON TABLE private\.legacy_node_records TO service_role/);
  assert.doesNotMatch(nodeBackfillMigration, /GRANT [^;]*(?:INSERT|UPDATE|DELETE)[^;]* TO (?:anon|authenticated)/);
});

test('provides private resumable backfill checkpoint and append-only staging primitives', () => {
  assert.ok(legacyRelationSource.enumValues.includes('challenge_revision'));
  assert.equal(getTableConfig(researchGraphBackfillCheckpoints).schema, 'private');
  assert.equal(getTableColumns(researchGraphBackfillCheckpoints).sourceChecksums.notNull, true);
  assert.equal(getTableConfig(researchGraphBackfillStaging).primaryKeys[0].columns.length, 3);
  assert.equal(getTableColumns(researchGraphBackfillStaging).sourceChecksum.notNull, true);
  assert.match(backfillMigration, /research_graph_backfill_staging_append_only_trigger/);
  assert.match(backfillMigration, /completed research graph backfill checkpoint is immutable/);
  assert.match(backfillMigration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(backfillMigration, /REVOKE ALL ON TABLE private\.research_graph_backfill_checkpoints FROM anon/);
  assert.match(backfillMigration, /REVOKE ALL ON TABLE private\.research_graph_backfill_staging FROM authenticated/);
  assert.match(backfillMigration, /GRANT SELECT, INSERT ON TABLE private\.research_graph_backfill_checkpoints TO service_role/);
  assert.match(backfillMigration, /GRANT UPDATE \(phase, cursors, completed_sources, source_counts, source_checksums, plan_checksum, updated_at, completed_at\)/);
  assert.match(backfillMigration, /GRANT SELECT, INSERT ON TABLE private\.research_graph_backfill_staging TO service_role/);
  assert.match(backfillMigration, /CREATE OR REPLACE VIEW public\.research_graph_legacy_relations\s+WITH \(security_invoker = true\)/);
  assert.match(backfillMigration, /REVOKE ALL ON TABLE public\.research_graph_legacy_relations FROM anon/);
  assert.match(backfillMigration, /REVOKE ALL ON TABLE public\.research_graph_legacy_relations FROM authenticated/);
  assert.match(backfillMigration, /GRANT SELECT ON TABLE public\.research_graph_legacy_relations TO service_role/);
  assert.doesNotMatch(backfillMigration, /GRANT [^;]*(?:INSERT|UPDATE|DELETE)[^;]* TO (?:anon|authenticated)/);
});

test('migration enforces registry, event-bound edges, tuple order, and complete motifs', () => {
  assert.match(migration, /ROW\("private"\."research_edges"\."source_commit_rank", "private"\."research_edges"\."source_batch_rank"\) < ROW/);
  assert.match(migration, /enforce_research_edge_registry/);
  for (const relation of [
    'answers', 'rebuts', 'evaluates', 'evaluation_basis', 'materializes_dataset', 'packages_tool',
  ]) {
    assert.match(migration, new RegExp(`WHEN '${relation}'`));
  }
  for (const relation of ['materializes_evidence', 'verifies_claim', 'verifies_run', 'uses_verification_contract', 'reports_finding']) {
    assert.match(nodeBackfillMigration, new RegExp(`WHEN '${relation}'`));
  }
  assert.match(migration, /target revision source event/);
  assert.match(migration, /CREATE CONSTRAINT TRIGGER research_node_revisions_lineage_edge_trigger/);
  assert.match(migration, /non-genesis revision requires exactly one previous revision supersedes edge/);
  assert.match(migration, /NEW\.source_kind = 'task' AND NEW\.target_kind = 'task'/);
  assert.match(migration, /NEW\.source_kind IN \('question', 'answer', 'claim', 'dataset', 'tool', 'artifact', 'evidence', 'run', 'context_bundle'\) AND NEW\.target_kind = 'answer'/);
  assert.match(migration, /research edge author requires owner, maintainer, or contributor project role/);
  assert.match(migration, /research edge author must match the immutable target revision author/);
  assert.match(migration, /research edge author cannot reference a hidden source project/);
  assert.doesNotMatch(migration, /WHEN 'requires' THEN true/);
  assert.doesNotMatch(migration, /WHEN 'derived_from' THEN true/);
  assert.match(migration, /DEFERRABLE INITIALLY DEFERRED/);
  assert.match(migration, /Evaluation revision requires at least one basis/);
});

test('migration exposes RLS-safe graph and typed security-invoker views', () => {
  for (const view of [
    'research_graph_nodes', 'research_graph_edges', 'research_answers', 'research_rebuttals',
    'research_evaluations', 'research_evaluation_bases', 'research_datasets', 'research_tools',
  ]) assert.match(migration, new RegExp(`CREATE OR REPLACE VIEW public\\.${view}\\s+WITH \\(security_invoker = true\\)`));
  assert.match(migration, /ALTER TABLE private\.%I ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /GRANT USAGE ON SCHEMA private TO anon, authenticated/);
  assert.match(migration, /GRANT SELECT ON private\.research_nodes, private\.research_node_revisions, private\.research_edges TO anon, authenticated/);
  assert.match(migration, /public\.research_answers, public\.research_rebuttals,[\s\S]*TO anon, authenticated/);
  assert.match(migration, /CREATE POLICY rg_nodes_public_read/);
  assert.match(migration, /project\.state = 'active'/);
  assert.match(migration, /project\.deleted_at IS NULL/);
  assert.match(migration, /CREATE POLICY rg_nodes_member_read/);
  assert.match(migration, /membership\.project_id = research_nodes\.project_id/);
  assert.match(migration, /identity\.subject = \(SELECT auth\.uid\(\)\)::text/);
  assert.match(migration, /CREATE POLICY rg_edges_visible_read/);
  assert.match(migration, /source_revision\.node_kind = research_edges\.source_kind/);
  assert.match(migration, /target_revision\.node_kind = research_edges\.target_kind/);
  assert.match(migration, /CREATE POLICY rg_evaluation_bases_visible_read/);
  assert.match(migration, /basis_revision\.node_kind = evaluation_bases\.basis_kind/);
  assert.doesNotMatch(migration, /GRANT (?:INSERT|UPDATE|DELETE)[^;]* TO anon/);
  assert.doesNotMatch(migration, /GRANT (?:INSERT|UPDATE|DELETE)[^;]* TO authenticated/);
  assert.match(migration, /REVOKE ALL ON SEQUENCE private\.research_commit_rank_seq FROM PUBLIC/);
});
