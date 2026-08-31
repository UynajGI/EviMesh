import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { projects } from './projects.mjs';
import { researchEvents } from './research-events.mjs';

export const researchGraphSchema = pgSchema('private');

export const researchNodeKind = researchGraphSchema.enum('research_node_kind', [
  'project', 'research_contract', 'question', 'answer', 'claim', 'rebuttal', 'evaluation',
  'dataset', 'tool', 'artifact', 'evidence', 'task', 'attempt', 'context_bundle', 'run',
  'verification_contract', 'verification_policy', 'policy_evaluation', 'verification_receipt',
  'verification_finding', 'challenge', 'merge_proposal', 'frontier_snapshot',
]);

export const researchDocumentState = researchGraphSchema.enum('research_document_state', [
  'draft', 'published', 'superseded', 'retracted',
]);

export const researchEdgeType = researchGraphSchema.enum('research_edge_type', [
  'extends_question', 'answers', 'yields_claim', 'rebuts', 'grounds_rebuttal', 'evaluates',
  'evaluation_basis', 'challenges', 'uses_dataset', 'uses_tool', 'uses_artifact',
  'materializes_dataset', 'packages_tool', 'materializes_evidence',
  'operationalizes', 'attempted_as', 'produces_run', 'context_for', 'run_input',
  'produces_artifact', 'produces_evidence', 'verifies_claim', 'verifies_run',
  'uses_verification_contract', 'reports_finding', 'requires', 'derived_from', 'extends',
  'implements', 'supersedes',
]);

export const evaluationStance = researchGraphSchema.enum('evaluation_stance', [
  'supports', 'refutes', 'qualifies', 'reproduces', 'verifies',
]);

export const toolKind = researchGraphSchema.enum('tool_kind', [
  'skill', 'method', 'software', 'model', 'workflow',
]);

export const legacyRelationSource = researchGraphSchema.enum('legacy_relation_source', [
  'research_node', 'claim_relation', 'evidence_claim_link', 'challenge_revision', 'challenge_impact', 'task_dependency', 'run_input', 'run_output',
]);

export const researchGraphBackfillPhase = researchGraphSchema.enum('research_graph_backfill_phase', [
  'scanning', 'applying', 'blocked', 'complete',
]);

export const legacyMappingKind = researchGraphSchema.enum('legacy_mapping_kind', [
  'direct', 'evaluation', 'rebuttal', 'archive',
]);

export const legacyMappingStatus = researchGraphSchema.enum('legacy_mapping_status', [
  'mapped', 'quarantined', 'archived',
]);

export const migrationFindingType = researchGraphSchema.enum('migration_finding_type', [
  'cycle', 'self_loop', 'dangling_revision', 'run_io_overlap', 'unmapped_relation', 'unmapped_node',
]);

export const migrationFindingSeverity = researchGraphSchema.enum('migration_finding_severity', [
  'blocking', 'warning',
]);

export const migrationFindingStatus = researchGraphSchema.enum('migration_finding_status', [
  'active', 'resolved', 'archived',
]);

export const researchCommitRankSequence = researchGraphSchema.sequence('research_commit_rank_seq', {
  startWith: 1,
  increment: 1,
  minValue: 1,
});

export const researchNodes = researchGraphSchema.table(
  'research_nodes',
  {
    nodeId: text('node_id').primaryKey(),
    nodeKind: researchNodeKind('node_kind').notNull(),
    projectId: text('project_id').notNull().references(() => projects.projectId, { onDelete: 'restrict' }),
    createdBy: text('created_by').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
  },
  (table) => [
    unique('research_nodes_kind_id_unique').on(table.nodeKind, table.nodeId),
    index('research_nodes_project_kind_idx').on(table.projectId, table.nodeKind),
    check('research_nodes_id_nonempty', sql`${table.nodeId} <> ''`),
    check('research_nodes_retirement_ordered', sql`${table.retiredAt} IS NULL OR ${table.retiredAt} >= ${table.createdAt}`),
  ],
);

export const researchNodeRevisions = researchGraphSchema.table(
  'research_node_revisions',
  {
    nodeKind: researchNodeKind('node_kind').notNull(),
    nodeId: text('node_id').notNull(),
    revision: integer('revision').notNull(),
    supersedesRevision: integer('supersedes_revision'),
    commitRank: bigint('commit_rank', { mode: 'number' }).notNull().default(sql`nextval('private.research_commit_rank_seq')`),
    batchRank: integer('batch_rank').notNull().default(1),
    canonicalContentHash: text('canonical_content_hash').notNull(),
    label: text('label').notNull(),
    state: researchDocumentState('state').notNull().default('draft'),
    canonicalHref: text('canonical_href').notNull(),
    sourceEventId: text('source_event_id').notNull().references(() => researchEvents.eventId, { onDelete: 'restrict' }),
    createdBy: text('created_by').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'research_node_revisions_pkey', columns: [table.nodeKind, table.nodeId, table.revision] }),
    foreignKey({
      name: 'research_node_revisions_node_fk',
      columns: [table.nodeKind, table.nodeId],
      foreignColumns: [researchNodes.nodeKind, researchNodes.nodeId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'research_node_revisions_supersedes_fk',
      columns: [table.nodeKind, table.nodeId, table.supersedesRevision],
      foreignColumns: [table.nodeKind, table.nodeId, table.revision],
    }).onDelete('restrict'),
    unique('research_node_revisions_rank_ref_unique').on(table.nodeKind, table.nodeId, table.revision, table.commitRank, table.batchRank),
    uniqueIndex('research_node_revisions_rank_unique').on(table.commitRank, table.batchRank),
    index('research_node_revisions_node_current_idx').on(table.nodeKind, table.nodeId, table.revision),
    index('research_node_revisions_event_idx').on(table.sourceEventId),
    check('research_node_revisions_revision_positive', sql`${table.revision} > 0`),
    check('research_node_revisions_rank_positive', sql`${table.commitRank} > 0 AND ${table.batchRank} > 0`),
    check('research_node_revisions_hash_format', sql`${table.canonicalContentHash} ~ '^sha256:[0-9a-f]{64}$'`),
    check('research_node_revisions_label_nonempty', sql`${table.label} <> ''`),
    check('research_node_revisions_href_absolute', sql`${table.canonicalHref} ~ '^/'`),
    check('research_node_revisions_supersedes_previous', sql`(${table.revision} = 1 AND ${table.supersedesRevision} IS NULL) OR (${table.revision} > 1 AND ${table.supersedesRevision} = ${table.revision} - 1)`),
  ],
);

export const researchEdges = researchGraphSchema.table(
  'research_edges',
  {
    edgeId: text('edge_id').primaryKey(),
    edgeType: researchEdgeType('edge_type').notNull(),
    sourceKind: researchNodeKind('source_kind').notNull(),
    sourceId: text('source_id').notNull(),
    sourceRevision: integer('source_revision').notNull(),
    sourceCommitRank: bigint('source_commit_rank', { mode: 'number' }).notNull(),
    sourceBatchRank: integer('source_batch_rank').notNull(),
    targetKind: researchNodeKind('target_kind').notNull(),
    targetId: text('target_id').notNull(),
    targetRevision: integer('target_revision').notNull(),
    targetCommitRank: bigint('target_commit_rank', { mode: 'number' }).notNull(),
    targetBatchRank: integer('target_batch_rank').notNull(),
    provenanceEventId: text('provenance_event_id').notNull().references(() => researchEvents.eventId, { onDelete: 'restrict' }),
    createdBy: text('created_by').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'research_edges_source_revision_fk',
      columns: [table.sourceKind, table.sourceId, table.sourceRevision, table.sourceCommitRank, table.sourceBatchRank],
      foreignColumns: [researchNodeRevisions.nodeKind, researchNodeRevisions.nodeId, researchNodeRevisions.revision, researchNodeRevisions.commitRank, researchNodeRevisions.batchRank],
    }).onDelete('restrict'),
    foreignKey({
      name: 'research_edges_target_revision_fk',
      columns: [table.targetKind, table.targetId, table.targetRevision, table.targetCommitRank, table.targetBatchRank],
      foreignColumns: [researchNodeRevisions.nodeKind, researchNodeRevisions.nodeId, researchNodeRevisions.revision, researchNodeRevisions.commitRank, researchNodeRevisions.batchRank],
    }).onDelete('restrict'),
    uniqueIndex('research_edges_unique').on(table.edgeType, table.sourceKind, table.sourceId, table.sourceRevision, table.targetKind, table.targetId, table.targetRevision),
    index('research_edges_source_idx').on(table.sourceKind, table.sourceId, table.sourceRevision),
    index('research_edges_target_idx').on(table.targetKind, table.targetId, table.targetRevision),
    index('research_edges_event_idx').on(table.provenanceEventId),
    check('research_edges_forward_rank', sql`ROW(${table.sourceCommitRank}, ${table.sourceBatchRank}) < ROW(${table.targetCommitRank}, ${table.targetBatchRank})`),
    check('research_edges_revision_positive', sql`${table.sourceRevision} > 0 AND ${table.targetRevision} > 0`),
  ],
);

function typedRevisionConstraints(table, kind, idColumn) {
  return [
    primaryKey({ name: `${kind}_revisions_pkey`, columns: [idColumn, table.revision] }),
    foreignKey({
      name: `${kind}_revisions_node_fk`,
      columns: [table.nodeKind, idColumn, table.revision],
      foreignColumns: [researchNodeRevisions.nodeKind, researchNodeRevisions.nodeId, researchNodeRevisions.revision],
    }).onDelete('restrict'),
    check(`${kind}_revisions_kind_fixed`, sql`${table.nodeKind} = ${sql.raw(`'${kind}'`)}`),
  ];
}

export const answerRevisions = researchGraphSchema.table(
  'answer_revisions',
  {
    answerId: text('answer_id').notNull(),
    revision: integer('revision').notNull(),
    nodeKind: researchNodeKind('node_kind').notNull().default('answer'),
    title: text('title').notNull(),
    synthesis: text('synthesis').notNull(),
    limitations: text('limitations').array().notNull().default(sql`ARRAY[]::text[]`),
  },
  (table) => [
    ...typedRevisionConstraints(table, 'answer', table.answerId),
    check('answer_revisions_content_nonempty', sql`${table.title} <> '' AND ${table.synthesis} <> ''`),
  ],
);

export const rebuttalRevisions = researchGraphSchema.table(
  'rebuttal_revisions',
  {
    rebuttalId: text('rebuttal_id').notNull(),
    revision: integer('revision').notNull(),
    nodeKind: researchNodeKind('node_kind').notNull().default('rebuttal'),
    title: text('title').notNull(),
    argument: text('argument').notNull(),
    scope: text('scope').array().notNull().default(sql`ARRAY[]::text[]`),
  },
  (table) => [
    ...typedRevisionConstraints(table, 'rebuttal', table.rebuttalId),
    check('rebuttal_revisions_content_nonempty', sql`${table.title} <> '' AND ${table.argument} <> ''`),
  ],
);

export const evaluationRevisions = researchGraphSchema.table(
  'evaluation_revisions',
  {
    evaluationId: text('evaluation_id').notNull(),
    revision: integer('revision').notNull(),
    nodeKind: researchNodeKind('node_kind').notNull().default('evaluation'),
    subjectKind: researchNodeKind('subject_kind').notNull(),
    subjectId: text('subject_id').notNull(),
    subjectRevision: integer('subject_revision').notNull(),
    stance: evaluationStance('stance').notNull(),
    rationale: text('rationale').notNull(),
    method: text('method'),
  },
  (table) => [
    ...typedRevisionConstraints(table, 'evaluation', table.evaluationId),
    foreignKey({
      name: 'evaluation_revisions_subject_fk',
      columns: [table.subjectKind, table.subjectId, table.subjectRevision],
      foreignColumns: [researchNodeRevisions.nodeKind, researchNodeRevisions.nodeId, researchNodeRevisions.revision],
    }).onDelete('restrict'),
    index('evaluation_revisions_subject_idx').on(table.subjectKind, table.subjectId, table.subjectRevision),
    check('evaluation_revisions_subject_claim', sql`${table.subjectKind} = 'claim'`),
    check('evaluation_revisions_rationale_nonempty', sql`${table.rationale} <> ''`),
  ],
);

export const evaluationBases = researchGraphSchema.table(
  'evaluation_bases',
  {
    evaluationId: text('evaluation_id').notNull(),
    evaluationRevision: integer('evaluation_revision').notNull(),
    basisKind: researchNodeKind('basis_kind').notNull(),
    basisId: text('basis_id').notNull(),
    basisRevision: integer('basis_revision').notNull(),
  },
  (table) => [
    primaryKey({ name: 'evaluation_bases_pkey', columns: [table.evaluationId, table.evaluationRevision, table.basisKind, table.basisId, table.basisRevision] }),
    foreignKey({
      name: 'evaluation_bases_evaluation_fk',
      columns: [table.evaluationId, table.evaluationRevision],
      foreignColumns: [evaluationRevisions.evaluationId, evaluationRevisions.revision],
    }).onDelete('restrict'),
    foreignKey({
      name: 'evaluation_bases_basis_fk',
      columns: [table.basisKind, table.basisId, table.basisRevision],
      foreignColumns: [researchNodeRevisions.nodeKind, researchNodeRevisions.nodeId, researchNodeRevisions.revision],
    }).onDelete('restrict'),
    index('evaluation_bases_basis_idx').on(table.basisKind, table.basisId, table.basisRevision),
    check('evaluation_bases_kind_allowed', sql`${table.basisKind} IN ('claim', 'evidence', 'run', 'dataset', 'artifact')`),
  ],
);

export const datasetRevisions = researchGraphSchema.table(
  'dataset_revisions',
  {
    datasetId: text('dataset_id').notNull(),
    revision: integer('revision').notNull(),
    nodeKind: researchNodeKind('node_kind').notNull().default('dataset'),
    name: text('name').notNull(),
    description: text('description').notNull(),
    version: text('version').notNull(),
    license: text('license').notNull(),
    schemaUri: text('schema_uri'),
    provenance: text('provenance').notNull(),
    artifactKind: researchNodeKind('artifact_kind').notNull().default('artifact'),
    artifactId: text('artifact_id').notNull(),
    artifactRevision: integer('artifact_revision').notNull(),
  },
  (table) => [
    ...typedRevisionConstraints(table, 'dataset', table.datasetId),
    foreignKey({
      name: 'dataset_revisions_artifact_fk',
      columns: [table.artifactKind, table.artifactId, table.artifactRevision],
      foreignColumns: [researchNodeRevisions.nodeKind, researchNodeRevisions.nodeId, researchNodeRevisions.revision],
    }).onDelete('restrict'),
    index('dataset_revisions_artifact_idx').on(table.artifactKind, table.artifactId, table.artifactRevision),
    check('dataset_revisions_artifact_kind_fixed', sql`${table.artifactKind} = 'artifact'`),
    check('dataset_revisions_content_nonempty', sql`${table.name} <> '' AND ${table.description} <> '' AND ${table.version} <> '' AND ${table.license} <> '' AND ${table.provenance} <> ''`),
  ],
);

export const toolRevisions = researchGraphSchema.table(
  'tool_revisions',
  {
    toolId: text('tool_id').notNull(),
    revision: integer('revision').notNull(),
    nodeKind: researchNodeKind('node_kind').notNull().default('tool'),
    name: text('name').notNull(),
    description: text('description').notNull(),
    toolKind: toolKind('tool_kind').notNull(),
    version: text('version').notNull(),
    runtime: text('runtime').notNull(),
    inputSchemaUri: text('input_schema_uri'),
    outputSchemaUri: text('output_schema_uri'),
    license: text('license').notNull(),
    provenance: text('provenance').notNull(),
    artifactKind: researchNodeKind('artifact_kind'),
    artifactId: text('artifact_id'),
    artifactRevision: integer('artifact_revision'),
  },
  (table) => [
    ...typedRevisionConstraints(table, 'tool', table.toolId),
    foreignKey({
      name: 'tool_revisions_artifact_fk',
      columns: [table.artifactKind, table.artifactId, table.artifactRevision],
      foreignColumns: [researchNodeRevisions.nodeKind, researchNodeRevisions.nodeId, researchNodeRevisions.revision],
    }).onDelete('restrict'),
    index('tool_revisions_artifact_idx').on(table.artifactKind, table.artifactId, table.artifactRevision),
    check('tool_revisions_artifact_ref_complete', sql`(${table.artifactKind} IS NULL AND ${table.artifactId} IS NULL AND ${table.artifactRevision} IS NULL) OR (${table.artifactKind} = 'artifact' AND ${table.artifactId} IS NOT NULL AND ${table.artifactRevision} > 0)`),
    check('tool_revisions_content_nonempty', sql`${table.name} <> '' AND ${table.description} <> '' AND ${table.version} <> '' AND ${table.runtime} <> '' AND ${table.license} <> '' AND ${table.provenance} <> ''`),
  ],
);

export const legacyRelationRecords = researchGraphSchema.table(
  'legacy_relation_records',
  {
    mappingId: text('mapping_id').primaryKey(),
    projectId: text('project_id').notNull().references(() => projects.projectId, { onDelete: 'restrict' }),
    source: legacyRelationSource('source').notNull(),
    sourceKey: text('source_key').notNull(),
    sourcePayload: jsonb('source_payload').notNull(),
    sourceChecksum: text('source_checksum').notNull(),
    mappingKind: legacyMappingKind('mapping_kind').notNull(),
    status: legacyMappingStatus('status').notNull(),
    mappedNodeKind: researchNodeKind('mapped_node_kind'),
    mappedNodeId: text('mapped_node_id'),
    mappedNodeRevision: integer('mapped_node_revision'),
    mappedEdgeId: text('mapped_edge_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('legacy_relation_records_source_unique').on(table.source, table.sourceKey),
    index('legacy_relation_records_project_status_idx').on(table.projectId, table.status),
    foreignKey({
      name: 'legacy_relation_records_mapped_node_fk',
      columns: [table.mappedNodeKind, table.mappedNodeId, table.mappedNodeRevision],
      foreignColumns: [researchNodeRevisions.nodeKind, researchNodeRevisions.nodeId, researchNodeRevisions.revision],
    }).onDelete('restrict'),
    foreignKey({
      name: 'legacy_relation_records_mapped_edge_fk',
      columns: [table.mappedEdgeId],
      foreignColumns: [researchEdges.edgeId],
    }).onDelete('restrict'),
    check('legacy_relation_records_checksum_format', sql`${table.sourceChecksum} ~ '^sha256:[0-9a-f]{64}$'`),
    check('legacy_relation_records_mapping_target', sql`(${table.mappingKind} IN ('evaluation', 'rebuttal') AND ${table.mappedNodeKind} IS NOT NULL AND ${table.mappedNodeId} IS NOT NULL AND ${table.mappedNodeRevision} IS NOT NULL) OR (${table.mappingKind} = 'direct' AND ${table.mappedEdgeId} IS NOT NULL) OR (${table.mappingKind} = 'archive' AND ${table.status} IN ('quarantined', 'archived'))`),
  ],
);

/** Immutable crosswalk from one legacy typed revision row to the DAG kernel. */
export const legacyNodeRecords = researchGraphSchema.table(
  'legacy_node_records',
  {
    mappingId: text('mapping_id').primaryKey(),
    projectId: text('project_id').notNull().references(() => projects.projectId, { onDelete: 'restrict' }),
    sourceKind: researchNodeKind('source_kind').notNull(),
    sourceId: text('source_id').notNull(),
    sourceRevision: integer('source_revision').notNull(),
    sourcePayload: jsonb('source_payload').notNull(),
    sourceChecksum: text('source_checksum').notNull(),
    status: legacyMappingStatus('status').notNull(),
    mappedNodeKind: researchNodeKind('mapped_node_kind'),
    mappedNodeId: text('mapped_node_id'),
    mappedNodeRevision: integer('mapped_node_revision'),
    sourceEventId: text('source_event_id').references(() => researchEvents.eventId, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('legacy_node_records_source_unique').on(table.sourceKind, table.sourceId, table.sourceRevision),
    index('legacy_node_records_project_status_idx').on(table.projectId, table.status),
    foreignKey({
      name: 'legacy_node_records_mapped_node_fk',
      columns: [table.mappedNodeKind, table.mappedNodeId, table.mappedNodeRevision],
      foreignColumns: [researchNodeRevisions.nodeKind, researchNodeRevisions.nodeId, researchNodeRevisions.revision],
    }).onDelete('restrict'),
    check('legacy_node_records_source_revision_positive', sql`${table.sourceRevision} > 0`),
    check('legacy_node_records_checksum_format', sql`${table.sourceChecksum} ~ '^sha256:[0-9a-f]{64}$'`),
    check('legacy_node_records_mapping_target', sql`(${table.status} = 'mapped' AND ${table.mappedNodeKind} IS NOT NULL AND ${table.mappedNodeId} IS NOT NULL AND ${table.mappedNodeRevision} IS NOT NULL AND ${table.sourceEventId} IS NOT NULL) OR (${table.status} IN ('quarantined', 'archived') AND ${table.mappedNodeKind} IS NULL AND ${table.mappedNodeId} IS NULL AND ${table.mappedNodeRevision} IS NULL)`),
  ],
);

export const researchGraphMigrationFindings = researchGraphSchema.table(
  'research_graph_migration_findings',
  {
    findingId: text('finding_id').primaryKey(),
    projectId: text('project_id').notNull().references(() => projects.projectId, { onDelete: 'restrict' }),
    findingType: migrationFindingType('finding_type').notNull(),
    severity: migrationFindingSeverity('severity').notNull(),
    status: migrationFindingStatus('status').notNull().default('active'),
    memberRefs: jsonb('member_refs').notNull(),
    details: text('details').notNull(),
    legacyMappingId: text('legacy_mapping_id').references(() => legacyRelationRecords.mappingId, { onDelete: 'restrict' }),
    legacyNodeMappingId: text('legacy_node_mapping_id').references(() => legacyNodeRecords.mappingId, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: text('resolved_by').references(() => actors.actorId, { onDelete: 'restrict' }),
  },
  (table) => [
    index('research_graph_migration_findings_project_status_idx').on(table.projectId, table.status, table.severity),
    check('research_graph_migration_findings_details_nonempty', sql`${table.details} <> ''`),
    check('research_graph_migration_findings_resolution_complete', sql`(${table.status} = 'active' AND ${table.resolvedAt} IS NULL AND ${table.resolvedBy} IS NULL) OR (${table.status} IN ('resolved', 'archived') AND ${table.resolvedAt} IS NOT NULL AND ${table.resolvedBy} IS NOT NULL)`),
  ],
);

/**
 * Durable per-project cursor and parity state for the repository-driven legacy
 * backfill. These internal rows are operational state, never research DAG
 * vertices and never part of the browser read surface.
 */
export const researchGraphBackfillCheckpoints = researchGraphSchema.table(
  'research_graph_backfill_checkpoints',
  {
    projectId: text('project_id').primaryKey().references(() => projects.projectId, { onDelete: 'restrict' }),
    schemaVersion: text('schema_version').notNull(),
    phase: researchGraphBackfillPhase('phase').notNull().default('scanning'),
    cursors: jsonb('cursors').notNull().default(sql`'{}'::jsonb`),
    completedSources: text('completed_sources').array().notNull().default(sql`ARRAY[]::text[]`),
    sourceCounts: jsonb('source_counts').notNull().default(sql`'{}'::jsonb`),
    sourceChecksums: jsonb('source_checksums').notNull().default(sql`'{}'::jsonb`),
    planChecksum: text('plan_checksum'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('research_graph_backfill_checkpoints_phase_idx').on(table.phase, table.updatedAt),
    check('research_graph_backfill_checkpoints_schema', sql`${table.schemaVersion} = 'evimesh.research-graph-backfill-checkpoint.v1'`),
    check('research_graph_backfill_checkpoints_plan_checksum', sql`${table.planChecksum} IS NULL OR ${table.planChecksum} ~ '^sha256:[0-9a-f]{64}$'`),
    check('research_graph_backfill_checkpoints_completion', sql`(${table.phase} = 'complete' AND ${table.completedAt} IS NOT NULL AND ${table.planChecksum} IS NOT NULL) OR (${table.phase} <> 'complete' AND ${table.completedAt} IS NULL)`),
    check('research_graph_backfill_checkpoints_timestamps', sql`${table.updatedAt} >= ${table.createdAt}`),
  ],
);

/** Append-only canonical copies of scanned raw rows used for resume/parity. */
export const researchGraphBackfillStaging = researchGraphSchema.table(
  'research_graph_backfill_staging',
  {
    projectId: text('project_id').notNull().references(() => projects.projectId, { onDelete: 'restrict' }),
    source: legacyRelationSource('source').notNull(),
    sourceKey: text('source_key').notNull(),
    sourcePayload: jsonb('source_payload').notNull(),
    sourceChecksum: text('source_checksum').notNull(),
    scannedAt: timestamp('scanned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'research_graph_backfill_staging_pkey', columns: [table.projectId, table.source, table.sourceKey] }),
    index('research_graph_backfill_staging_source_idx').on(table.projectId, table.source, table.sourceKey),
    check('research_graph_backfill_staging_key_nonempty', sql`${table.sourceKey} <> ''`),
    check('research_graph_backfill_staging_checksum_format', sql`${table.sourceChecksum} ~ '^sha256:[0-9a-f]{64}$'`),
  ],
);
