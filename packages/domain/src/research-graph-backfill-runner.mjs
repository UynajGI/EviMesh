import { canonicalJson, semanticHash } from '../../protocol/src/hash.mjs';
import {
  RESEARCH_GRAPH_BACKFILL_CHECKPOINT_SCHEMA,
  RESEARCH_GRAPH_BACKFILL_PHASES,
  RESEARCH_GRAPH_BACKFILL_PLAN_SCHEMA,
  RESEARCH_GRAPH_BACKFILL_SOURCES,
} from '../../protocol/src/research-graph-backfill.mjs';
import { assertResearchEdge, normalizeNodeRevisionRef } from '../../protocol/src/research-graph.mjs';
import {
  ResearchGraphMigrationError,
  assertResearchGraphCutoverReady,
  auditLegacyResearchGraph,
} from './research-graph-migration-audit.mjs';

const SOURCE_CONFIG = Object.freeze({
  research_node: Object.freeze({ scan: 'scanLegacyResearchNodesPage', field: null }),
  claim_relation: Object.freeze({ scan: 'scanLegacyClaimRelationsPage', field: 'claimRelations' }),
  evidence_claim_link: Object.freeze({ scan: 'scanLegacyEvidenceClaimLinksPage', field: 'evidenceClaimLinks' }),
  challenge_revision: Object.freeze({ scan: 'scanLegacyChallengeRevisionsPage', field: 'challengeRevisions' }),
  challenge_impact: Object.freeze({ scan: 'scanLegacyChallengeImpactsPage', field: 'challengeImpacts' }),
  task_dependency: Object.freeze({ scan: 'scanLegacyTaskDependenciesPage', field: 'taskDependencies' }),
  run_input: Object.freeze({ scan: 'scanLegacyRunInputsPage', field: 'runInputs' }),
  run_output: Object.freeze({ scan: 'scanLegacyRunOutputsPage', field: 'runOutputs' }),
});

export class ResearchGraphBackfillError extends Error {
  constructor(message, code = 'RESEARCH_GRAPH_BACKFILL_INVALID', status = 400) {
    super(message);
    this.name = 'ResearchGraphBackfillError';
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new ResearchGraphBackfillError(`${field} must be a non-empty string`);
  return value.trim();
}

function assertPlainJson(value, field, seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('non-finite number');
    return;
  }
  if (typeof value !== 'object') throw new TypeError(`unsupported ${typeof value}`);
  if (seen.has(value)) throw new TypeError('cyclic value');
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new TypeError('non-plain object; scanner must encode dates and binary signature bytes explicitly');
  }
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) assertPlainJson(item, field, seen);
  } else {
    for (const item of Object.values(value)) assertPlainJson(item, field, seen);
  }
  seen.delete(value);
}

function cloneJson(value, field) {
  try {
    assertPlainJson(value, field);
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    throw new ResearchGraphBackfillError(`${field} must be JSON-compatible: ${error.message}`);
  }
}

function value(row, ...names) {
  for (const name of names) if (row?.[name] !== undefined && row?.[name] !== null) return row[name];
  return null;
}

function rowSourceKey(source, row) {
  const part = (...names) => String(value(row, ...names) ?? '<missing>');
  switch (source) {
    case 'research_node': return `${part('kind', 'nodeKind', 'node_kind')}:${part('id', 'nodeId', 'node_id')}@${part('revision')}`;
    case 'claim_relation': return `${part('sourceClaimId', 'source_claim_id')}@${part('sourceRevision', 'source_revision')}|${part('relationType', 'relation_type', 'type')}|${part('targetClaimId', 'target_claim_id')}@${part('targetRevision', 'target_revision')}`;
    case 'evidence_claim_link': return `${part('evidenceId', 'evidence_id')}|${part('relationType', 'relation_type', 'type')}|${part('claimId', 'claim_id')}@${part('claimRevision', 'claim_revision')}`;
    case 'challenge_revision': return `${part('challengeId', 'challenge_id')}@${part('challengeRevision', 'challenge_revision', 'revision')}`;
    case 'challenge_impact': return part('impactId', 'impact_id');
    case 'task_dependency': return `${part('sourceTaskId', 'source_task_id')}@${part('sourceTaskRevision', 'source_task_revision')}|${part('targetTaskId', 'target_task_id')}@${part('targetTaskRevision', 'target_task_revision')}`;
    case 'run_input':
    case 'run_output': return `${part('runId', 'run_id')}@${String(value(row, 'runRevision', 'run_revision') ?? 1)}|${part('artifactId', 'artifact_id')}@${part('artifactRevision', 'artifact_revision')}`;
    default: throw new ResearchGraphBackfillError(`unsupported backfill source: ${source}`);
  }
}

function stageRow(projectId, source, raw) {
  const sourcePayload = cloneJson(raw, `${source} row`);
  return Object.freeze({
    projectId,
    source,
    sourceKey: rowSourceKey(source, sourcePayload),
    sourcePayload,
    sourceChecksum: `sha256:${semanticHash(sourcePayload)}`,
  });
}

function sourceParity(rows) {
  const entries = [...rows].sort((left, right) => left.sourceKey.localeCompare(right.sourceKey));
  return Object.freeze({
    count: entries.length,
    checksum: `sha256:${semanticHash(entries.map(({ sourceKey, sourceChecksum }) => ({ sourceKey, sourceChecksum })))}`,
  });
}

function initialCheckpoint(projectId, now) {
  return Object.freeze({
    schemaVersion: RESEARCH_GRAPH_BACKFILL_CHECKPOINT_SCHEMA,
    projectId,
    phase: 'scanning',
    cursors: Object.freeze(Object.fromEntries(RESEARCH_GRAPH_BACKFILL_SOURCES.map((source) => [source, null]))),
    completedSources: Object.freeze([]),
    sourceCounts: Object.freeze({}),
    sourceChecksums: Object.freeze({}),
    planChecksum: null,
    updatedAt: now(),
    completedAt: null,
  });
}

function validateCheckpoint(checkpoint, projectId) {
  if (!checkpoint || typeof checkpoint !== 'object'
    || checkpoint.schemaVersion !== RESEARCH_GRAPH_BACKFILL_CHECKPOINT_SCHEMA
    || checkpoint.projectId !== projectId) {
    throw new ResearchGraphBackfillError('repository returned an invalid backfill checkpoint identity', 'RESEARCH_GRAPH_BACKFILL_CHECKPOINT_INVALID', 409);
  }
  if (!RESEARCH_GRAPH_BACKFILL_PHASES.includes(checkpoint.phase)
    || !Array.isArray(checkpoint.completedSources)
    || !checkpoint.cursors || typeof checkpoint.cursors !== 'object' || Array.isArray(checkpoint.cursors)
    || !checkpoint.sourceCounts || typeof checkpoint.sourceCounts !== 'object' || Array.isArray(checkpoint.sourceCounts)
    || !checkpoint.sourceChecksums || typeof checkpoint.sourceChecksums !== 'object' || Array.isArray(checkpoint.sourceChecksums)) {
    throw new ResearchGraphBackfillError('repository returned malformed backfill checkpoint state', 'RESEARCH_GRAPH_BACKFILL_CHECKPOINT_INVALID', 409);
  }
  if (new Set(checkpoint.completedSources).size !== checkpoint.completedSources.length
    || checkpoint.completedSources.some((source) => !RESEARCH_GRAPH_BACKFILL_SOURCES.includes(source))) {
    throw new ResearchGraphBackfillError('backfill checkpoint contains unsupported or duplicate sources', 'RESEARCH_GRAPH_BACKFILL_CHECKPOINT_INVALID', 409);
  }
  for (const source of RESEARCH_GRAPH_BACKFILL_SOURCES) {
    const cursor = checkpoint.cursors[source];
    const count = checkpoint.sourceCounts[source];
    const checksum = checkpoint.sourceChecksums[source];
    if (!(cursor === null || (typeof cursor === 'string' && cursor.length > 0))) {
      throw new ResearchGraphBackfillError(`backfill checkpoint cursor is invalid for ${source}`, 'RESEARCH_GRAPH_BACKFILL_CHECKPOINT_INVALID', 409);
    }
    if (count !== undefined && (!Number.isSafeInteger(count) || count < 0)) {
      throw new ResearchGraphBackfillError(`backfill checkpoint count is invalid for ${source}`, 'RESEARCH_GRAPH_BACKFILL_CHECKPOINT_INVALID', 409);
    }
    if (checksum !== undefined && !/^sha256:[0-9a-f]{64}$/.test(checksum)) {
      throw new ResearchGraphBackfillError(`backfill checkpoint checksum is invalid for ${source}`, 'RESEARCH_GRAPH_BACKFILL_CHECKPOINT_INVALID', 409);
    }
    if (checkpoint.phase === 'complete' && (!checkpoint.completedSources.includes(source) || count === undefined || checksum === undefined)) {
      throw new ResearchGraphBackfillError(`complete backfill checkpoint lacks parity for ${source}`, 'RESEARCH_GRAPH_BACKFILL_CHECKPOINT_INVALID', 409);
    }
  }
  if (checkpoint.planChecksum !== null && !/^sha256:[0-9a-f]{64}$/.test(checkpoint.planChecksum)) {
    throw new ResearchGraphBackfillError('backfill checkpoint plan checksum is invalid', 'RESEARCH_GRAPH_BACKFILL_CHECKPOINT_INVALID', 409);
  }
  if (checkpoint.phase === 'complete' && (checkpoint.planChecksum === null || checkpoint.completedAt === null || checkpoint.completedAt === undefined)) {
    throw new ResearchGraphBackfillError('complete backfill checkpoint lacks its plan proof', 'RESEARCH_GRAPH_BACKFILL_CHECKPOINT_INVALID', 409);
  }
  return checkpoint;
}

function nextCheckpoint(checkpoint, changes, now) {
  return Object.freeze({ ...checkpoint, ...changes, updatedAt: now() });
}

function validatePage(page, { source, cursor, pageSize }) {
  if (!page || typeof page !== 'object' || !Array.isArray(page.rows)) throw new ResearchGraphBackfillError(`${source} scanner must return { rows, nextCursor }`);
  if (page.rows.length > pageSize) throw new ResearchGraphBackfillError(`${source} scanner exceeded the requested page size`);
  const nextCursor = page.nextCursor ?? null;
  if (nextCursor !== null && (typeof nextCursor !== 'string' || nextCursor.length === 0)) throw new ResearchGraphBackfillError(`${source} next cursor must be a non-empty string or null`);
  if (nextCursor !== null && nextCursor === cursor) throw new ResearchGraphBackfillError(`${source} scanner did not advance its cursor`);
  return Object.freeze({ rows: page.rows, nextCursor });
}

function assertRepository(repository, { dryRun }) {
  if (!repository || typeof repository !== 'object') throw new ResearchGraphBackfillError('backfill repository is required');
  for (const { scan } of Object.values(SOURCE_CONFIG)) if (typeof repository[scan] !== 'function') throw new ResearchGraphBackfillError(`repository ${scan} is required`);
  if (typeof repository.listKnownResearchNodeRevisionRefs !== 'function') throw new ResearchGraphBackfillError('repository listKnownResearchNodeRevisionRefs is required');
  if (dryRun) return;
  if (typeof repository.withTransaction !== 'function') throw new ResearchGraphBackfillError('repository withTransaction is required');
  for (const method of [
    'getResearchGraphBackfillCheckpoint', 'insertResearchGraphBackfillCheckpoint', 'updateResearchGraphBackfillCheckpoint',
    'getResearchGraphBackfillStaging', 'insertResearchGraphBackfillStaging', 'listResearchGraphBackfillStaging',
    'getLegacyRelationRecord', 'insertLegacyRelationRecord',
    'getResearchGraphMigrationFinding', 'insertResearchGraphMigrationFinding',
    'getLegacyNodeRecord', 'insertLegacyNodeRecord', 'materializeLegacyResearchNode',
    'materializeLegacyResearchEdge', 'materializeLegacyResearchMotif', 'materializeLegacyChallengeRevision',
  ]) if (typeof repository[method] !== 'function') throw new ResearchGraphBackfillError(`repository ${method} is required`);
}

async function scanDryRun(repository, { projectId, pageSize }) {
  const staged = [];
  for (const source of RESEARCH_GRAPH_BACKFILL_SOURCES) {
    const { scan } = SOURCE_CONFIG[source];
    let cursor = null;
    const seenCursors = new Set();
    for (;;) {
      const cursorKey = cursor ?? '<start>';
      if (seenCursors.has(cursorKey)) throw new ResearchGraphBackfillError(`${source} scanner repeated a cursor`, 'RESEARCH_GRAPH_BACKFILL_CURSOR_CYCLE', 409);
      seenCursors.add(cursorKey);
      const page = validatePage(await repository[scan]({ projectId, cursor, limit: pageSize }), { source, cursor, pageSize });
      staged.push(...page.rows.map((row) => stageRow(projectId, source, row)));
      if (page.nextCursor === null) break;
      cursor = page.nextCursor;
    }
  }
  return deduplicateStaging(staged);
}

function deduplicateStaging(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const key = `${row.source}:${row.sourceKey}`;
    const existing = byKey.get(key);
    if (existing && existing.sourceChecksum !== row.sourceChecksum) throw new ResearchGraphBackfillError(`legacy source changed during scan: ${key}`, 'RESEARCH_GRAPH_BACKFILL_SOURCE_CONFLICT', 409);
    if (!existing) byKey.set(key, row);
  }
  return [...byKey.values()].sort((left, right) => `${left.source}:${left.sourceKey}`.localeCompare(`${right.source}:${right.sourceKey}`));
}

async function ensureCheckpoint(repository, projectId, now) {
  const existing = await repository.getResearchGraphBackfillCheckpoint(projectId);
  if (existing) return validateCheckpoint(existing, projectId);
  const checkpoint = initialCheckpoint(projectId, now);
  return repository.withTransaction(async (transaction) => {
    const raced = await transaction.getResearchGraphBackfillCheckpoint(projectId);
    return raced ? validateCheckpoint(raced, projectId) : await transaction.insertResearchGraphBackfillCheckpoint(checkpoint) ?? checkpoint;
  });
}

async function scanWithCheckpoint(repository, { projectId, pageSize, checkpoint, now }) {
  for (const source of RESEARCH_GRAPH_BACKFILL_SOURCES) {
    if (checkpoint.completedSources.includes(source)) {
      if (checkpoint.sourceCounts[source] === undefined || checkpoint.sourceChecksums[source] === undefined) {
        const completedRows = deduplicateStaging(await repository.listResearchGraphBackfillStaging(projectId, source));
        const parity = sourceParity(completedRows);
        checkpoint = await repository.withTransaction(async (transaction) => {
          const updated = nextCheckpoint(checkpoint, {
            sourceCounts: Object.freeze({ ...checkpoint.sourceCounts, [source]: checkpoint.sourceCounts[source] ?? parity.count }),
            sourceChecksums: Object.freeze({ ...checkpoint.sourceChecksums, [source]: checkpoint.sourceChecksums[source] ?? parity.checksum }),
          }, now);
          return await transaction.updateResearchGraphBackfillCheckpoint(updated) ?? updated;
        });
      }
      continue;
    }
    const { scan } = SOURCE_CONFIG[source];
    let cursor = checkpoint.cursors[source] ?? null;
    const seenCursors = new Set();
    for (;;) {
      const cursorKey = cursor ?? '<start>';
      if (seenCursors.has(cursorKey)) throw new ResearchGraphBackfillError(`${source} scanner repeated a cursor`, 'RESEARCH_GRAPH_BACKFILL_CURSOR_CYCLE', 409);
      seenCursors.add(cursorKey);
      const page = validatePage(await repository[scan]({ projectId, cursor, limit: pageSize }), { source, cursor, pageSize });
      const stagedRows = page.rows.map((row) => stageRow(projectId, source, row));
      checkpoint = await repository.withTransaction(async (transaction) => {
        for (const staged of stagedRows) {
          const existing = await transaction.getResearchGraphBackfillStaging(projectId, source, staged.sourceKey);
          if (existing && existing.sourceChecksum !== staged.sourceChecksum) throw new ResearchGraphBackfillError(`legacy source changed after checkpoint: ${source}:${staged.sourceKey}`, 'RESEARCH_GRAPH_BACKFILL_SOURCE_CONFLICT', 409);
          if (!existing) await transaction.insertResearchGraphBackfillStaging(staged);
        }
        const completedSources = page.nextCursor === null
          ? [...new Set([...checkpoint.completedSources, source])]
          : checkpoint.completedSources;
        const updated = nextCheckpoint(checkpoint, {
          cursors: Object.freeze({ ...checkpoint.cursors, [source]: page.nextCursor }),
          completedSources: Object.freeze(completedSources),
        }, now);
        return await transaction.updateResearchGraphBackfillCheckpoint(updated) ?? updated;
      });
      if (page.nextCursor === null) break;
      cursor = page.nextCursor;
    }
    const sourceRows = deduplicateStaging(await repository.listResearchGraphBackfillStaging(projectId, source));
    const parity = sourceParity(sourceRows);
    checkpoint = await repository.withTransaction(async (transaction) => {
      const updated = nextCheckpoint(checkpoint, {
        sourceCounts: Object.freeze({ ...checkpoint.sourceCounts, [source]: parity.count }),
        sourceChecksums: Object.freeze({ ...checkpoint.sourceChecksums, [source]: parity.checksum }),
      }, now);
      return await transaction.updateResearchGraphBackfillCheckpoint(updated) ?? updated;
    });
  }
  const staged = [];
  for (const source of RESEARCH_GRAPH_BACKFILL_SOURCES) staged.push(...await repository.listResearchGraphBackfillStaging(projectId, source));
  return { checkpoint, staged: deduplicateStaging(staged) };
}

function unmappedRecord(projectId, staged, error) {
  const mappingId = `legacy_unmapped_${semanticHash({ source: staged.source, sourceKey: staged.sourceKey, sourceChecksum: staged.sourceChecksum })}`;
  const record = Object.freeze({
    mappingId, projectId, source: staged.source, sourceKey: staged.sourceKey,
    sourcePayload: staged.sourcePayload, sourceChecksum: staged.sourceChecksum,
    mappingKind: 'archive', status: 'quarantined', mappedNodeKind: null,
    mappedNodeId: null, mappedNodeRevision: null, mappedEdgeId: null, motif: null,
  });
  const memberRefs = Object.freeze([`${staged.source}:${staged.sourceKey}`]);
  const finding = Object.freeze({
    findingId: `finding_${semanticHash({ projectId, findingType: 'unmapped_relation', memberRefs, mappingId })}`,
    projectId, findingType: 'unmapped_relation', severity: 'blocking', status: 'active', memberRefs,
    details: `Legacy row could not be mapped without inventing an exact revision anchor: ${error.message}`,
    legacyMappingId: mappingId, resolvedAt: null, resolvedBy: null,
  });
  return { record, finding };
}

function plannedChallengeRefs(validBySource, knownRevisionRefs) {
  const known = new Set(knownRevisionRefs.map((ref) => `${ref.kind}:${ref.id}@${ref.revision}`));
  const candidates = validBySource.challenge_revision
    .filter((row) => !(value(row, 'deletedAt', 'deleted_at')))
    .filter((row) => known.has(`claim:${value(row, 'targetClaimId', 'target_claim_id')}@${value(row, 'targetClaimRevision', 'target_claim_revision')}`))
    .map((row) => ({
      kind: 'challenge',
      id: value(row, 'challengeId', 'challenge_id'),
      revision: value(row, 'challengeRevision', 'challenge_revision', 'revision'),
    }))
    .sort((left, right) => left.id.localeCompare(right.id) || left.revision - right.revision);
  const planned = [];
  // Only a contiguous lineage can be registered. Leaving a skipped revision
  // out of the known-ref set makes the normal dangling-revision audit archive
  // it and emit a blocking finding before any SQL apply begins.
  for (const ref of candidates) {
    const previous = ref.revision === 1 || known.has(`challenge:${ref.id}@${ref.revision - 1}`);
    if (!previous) continue;
    const key = `challenge:${ref.id}@${ref.revision}`;
    if (!known.has(key)) planned.push(ref);
    known.add(key);
  }
  return planned;
}

function legacyNodeMappingId(ref) {
  return `legacy_node_${semanticHash({ schema: 'evimesh.legacy-node-crosswalk.v1', ref })}`;
}

function nodeFinding(projectId, item, ref, details) {
  const mappingId = legacyNodeMappingId(ref);
  const memberRefs = Object.freeze([`${ref.kind}:${ref.id}@${ref.revision}`]);
  return Object.freeze({
    findingId: `finding_${semanticHash({ schema: 'evimesh.research-graph-migration-finding.v1', projectId, findingType: 'unmapped_node', memberRefs, legacyNodeMappingId: mappingId })}`,
    projectId, findingType: 'unmapped_node', severity: 'blocking', status: 'active', memberRefs,
    details, legacyMappingId: null, legacyNodeMappingId: mappingId, resolvedAt: null, resolvedBy: null,
  });
}

function auditStagedNodes({ projectId, items, knownRevisionRefs }) {
  const existing = new Set(knownRevisionRefs.map((ref) => `${ref.kind}:${ref.id}@${ref.revision}`));
  const candidates = [];
  const records = [];
  const findings = [];
  for (const item of items) {
    const payload = item.sourcePayload;
    let ref;
    try {
      ref = normalizeNodeRevisionRef({
        kind: value(payload, 'kind', 'nodeKind', 'node_kind'),
        id: value(payload, 'id', 'nodeId', 'node_id'),
        revision: value(payload, 'revision'),
      }, 'legacy research node');
      if (value(payload, 'projectId', 'project_id') !== projectId) throw new Error('node project evidence does not match the requested project');
      for (const [field, names] of Object.entries({
        createdBy: ['createdBy', 'created_by'], createdAt: ['createdAt', 'created_at'],
        label: ['label'], canonicalHref: ['canonicalHref', 'canonical_href'], sourceEventId: ['sourceEventId', 'source_event_id'],
      })) requiredText(value(payload, ...names), `legacy node ${field}`);
      if (!payload.content || typeof payload.content !== 'object' || Array.isArray(payload.content)) throw new Error('legacy node content must be an object');
      if (value(payload, 'coverageStatus', 'coverage_status') === 'unsupported') throw new Error(value(payload, 'coverageReason', 'coverage_reason') ?? 'typed node scanner is unsupported');
      candidates.push({ item, payload, ref });
    } catch (error) {
      ref ??= Object.freeze({
        kind: value(payload, 'kind', 'nodeKind', 'node_kind') ?? 'project',
        id: String(value(payload, 'id', 'nodeId', 'node_id') ?? item.sourceKey),
        revision: Number(value(payload, 'revision')) || 1,
      });
      const mappingId = legacyNodeMappingId(ref);
      records.push(Object.freeze({
        mappingId, projectId, source: 'research_node', sourceKey: item.sourceKey,
        sourceKind: ref.kind, sourceId: ref.id, sourceRevision: ref.revision,
        sourcePayload: item.sourcePayload, sourceChecksum: item.sourceChecksum, status: 'quarantined',
        mappedNodeKind: null, mappedNodeId: null, mappedNodeRevision: null, sourceEventId: null,
      }));
      findings.push(nodeFinding(projectId, item, ref, `Legacy node could not be registered without inventing identity or provenance: ${error.message}`));
    }
  }
  candidates.sort((left, right) => left.ref.kind.localeCompare(right.ref.kind) || left.ref.id.localeCompare(right.ref.id) || left.ref.revision - right.ref.revision);
  const accepted = new Set(existing);
  const registrations = [];
  for (const { item, payload, ref } of candidates) {
    const key = `${ref.kind}:${ref.id}@${ref.revision}`;
    const previousKey = `${ref.kind}:${ref.id}@${ref.revision - 1}`;
    const contiguous = ref.revision === 1 || accepted.has(previousKey);
    const mappingId = legacyNodeMappingId(ref);
    if (!contiguous) {
      records.push(Object.freeze({
        mappingId, projectId, source: 'research_node', sourceKey: item.sourceKey,
        sourceKind: ref.kind, sourceId: ref.id, sourceRevision: ref.revision,
        sourcePayload: item.sourcePayload, sourceChecksum: item.sourceChecksum, status: 'quarantined',
        mappedNodeKind: null, mappedNodeId: null, mappedNodeRevision: null, sourceEventId: null,
      }));
      findings.push(nodeFinding(projectId, item, ref, `Legacy node revision is not contiguous; exact predecessor ${previousKey} is missing.`));
      continue;
    }
    const registration = Object.freeze({
      ref,
      projectId,
      supersedesRevision: ref.revision === 1 ? null : ref.revision - 1,
      canonicalContentHash: `sha256:${semanticHash({ schema: 'evimesh.legacy-node-content.v1', kind: ref.kind, content: payload.content })}`,
      label: value(payload, 'label'),
      state: ['draft', 'superseded', 'retracted'].includes(value(payload, 'state')) ? value(payload, 'state') : 'published',
      canonicalHref: value(payload, 'canonicalHref', 'canonical_href'),
      sourceEventId: value(payload, 'sourceEventId', 'source_event_id'),
      createdBy: value(payload, 'createdBy', 'created_by'),
      stableCreatedBy: value(payload, 'stableCreatedBy', 'stable_created_by') ?? value(payload, 'createdBy', 'created_by'),
      createdAt: value(payload, 'createdAt', 'created_at'),
      stableCreatedAt: value(payload, 'stableCreatedAt', 'stable_created_at') ?? value(payload, 'createdAt', 'created_at'),
      retiredAt: value(payload, 'retiredAt', 'retired_at'),
    });
    records.push(Object.freeze({
      mappingId, projectId, source: 'research_node', sourceKey: item.sourceKey,
      sourceKind: ref.kind, sourceId: ref.id, sourceRevision: ref.revision,
      sourcePayload: item.sourcePayload, sourceChecksum: item.sourceChecksum, status: 'mapped',
      mappedNodeKind: ref.kind, mappedNodeId: ref.id, mappedNodeRevision: ref.revision,
      sourceEventId: registration.sourceEventId,
    }));
    registrations.push(Object.freeze({ mappingId, ...registration }));
    accepted.add(key);
  }
  return Object.freeze({
    records: Object.freeze(records.sort((a, b) => a.sourceKey.localeCompare(b.sourceKey))),
    findings: Object.freeze(findings.sort((a, b) => a.findingId.localeCompare(b.findingId))),
    registrations: Object.freeze(registrations),
    refs: Object.freeze([...accepted].map((key) => {
      const match = /^([^:]+):(.*)@(\d+)$/.exec(key);
      return { kind: match[1], id: match[2], revision: Number(match[3]) };
    })),
  });
}

function orderNodeRegistrations(registrations, operations) {
  const byKey = new Map(registrations.map((registration) => [`${registration.ref.kind}:${registration.ref.id}@${registration.ref.revision}`, registration]));
  const outgoing = new Map([...byKey.keys()].map((key) => [key, new Set()]));
  const indegree = new Map([...byKey.keys()].map((key) => [key, 0]));
  function depend(sourceRef, targetRef) {
    const source = `${sourceRef.kind}:${sourceRef.id}@${sourceRef.revision}`;
    const target = `${targetRef.kind}:${targetRef.id}@${targetRef.revision}`;
    if (!byKey.has(source) || !byKey.has(target) || source === target || outgoing.get(source).has(target)) return;
    outgoing.get(source).add(target);
    indegree.set(target, indegree.get(target) + 1);
  }
  for (const registration of registrations) if (registration.ref.revision > 1) {
    depend({ ...registration.ref, revision: registration.ref.revision - 1 }, registration.ref);
  }
  for (const operation of operations) if (operation.operation === 'edge') depend(operation.edge.source, operation.edge.target);
  const ready = [...byKey.keys()].filter((key) => indegree.get(key) === 0).sort();
  const ordered = [];
  while (ready.length > 0) {
    const key = ready.shift();
    ordered.push(byKey.get(key));
    for (const target of [...outgoing.get(key)].sort()) {
      indegree.set(target, indegree.get(target) - 1);
      if (indegree.get(target) === 0) {
        ready.push(target);
        ready.sort();
      }
    }
  }
  if (ordered.length !== registrations.length) throw new ResearchGraphBackfillError('node registration topology contains a cycle', 'RESEARCH_GRAPH_BACKFILL_NODE_CYCLE', 409);
  return Object.freeze(ordered);
}

function buildPlan({ projectId, staged, knownRevisionRefs }) {
  const nodeAudit = auditStagedNodes({ projectId, items: staged.filter((item) => item.source === 'research_node'), knownRevisionRefs });
  const validBySource = Object.fromEntries(RESEARCH_GRAPH_BACKFILL_SOURCES.map((source) => [source, []]));
  const unmappedRecords = [];
  const unmappedFindings = [];
  for (const item of staged) {
    if (item.source === 'research_node') continue;
    const field = SOURCE_CONFIG[item.source].field;
    try {
      auditLegacyResearchGraph({ projectId, [field]: [item.sourcePayload] });
      validBySource[item.source].push(item.sourcePayload);
    } catch (error) {
      const unmapped = unmappedRecord(projectId, item, error);
      unmappedRecords.push(unmapped.record);
      unmappedFindings.push(unmapped.finding);
    }
  }
  const audit = auditLegacyResearchGraph({
    projectId,
    claimRelations: validBySource.claim_relation,
    evidenceClaimLinks: validBySource.evidence_claim_link,
    challengeRevisions: validBySource.challenge_revision,
    challengeImpacts: validBySource.challenge_impact,
    taskDependencies: validBySource.task_dependency,
    runInputs: validBySource.run_input,
    runOutputs: validBySource.run_output,
    knownRevisionRefs: [...nodeAudit.refs, ...plannedChallengeRefs(validBySource, nodeAudit.refs)],
  });
  const records = [...audit.records, ...unmappedRecords].sort((left, right) => `${left.source}:${left.sourceKey}`.localeCompare(`${right.source}:${right.sourceKey}`));
  const findings = [...audit.findings, ...unmappedFindings, ...nodeAudit.findings].sort((left, right) => left.findingId.localeCompare(right.findingId));
  const allAuditRecords = [...nodeAudit.records, ...records];
  const completeAudit = Object.freeze({
    ...audit,
    sourceCount: staged.length,
    uniqueSourceCount: allAuditRecords.length,
    records: Object.freeze(allAuditRecords),
    findings: Object.freeze(findings),
  });
  const operations = records.flatMap((record) => {
    if (record.status !== 'mapped' || !record.motif) return [];
    if (record.motif.motif === 'direct') {
      assertResearchEdge(record.motif.edge);
      return [Object.freeze({
        operation: 'edge', mappingId: record.mappingId, edgeId: record.mappedEdgeId,
        edge: record.motif.edge, registerTarget: record.motif.registerTarget ?? null,
      })];
    }
    return [Object.freeze({
      operation: 'motif', mappingId: record.mappingId, motifType: record.motif.motif,
      node: Object.freeze({ kind: record.mappedNodeKind, id: record.mappedNodeId, revision: record.mappedNodeRevision }),
      subject: record.motif.subject, bases: record.motif.bases,
      stance: record.motif.stance ?? null, mode: record.motif.mode ?? null,
    })];
  });
  const nodeRegistrations = orderNodeRegistrations(nodeAudit.registrations, operations);
  const sourceCounts = {};
  const sourceChecksums = {};
  for (const source of RESEARCH_GRAPH_BACKFILL_SOURCES) {
    const parity = sourceParity(staged.filter((row) => row.source === source));
    sourceCounts[source] = parity.count;
    sourceChecksums[source] = parity.checksum;
  }
  const planBody = {
    schema: RESEARCH_GRAPH_BACKFILL_PLAN_SCHEMA, projectId,
    sourceCounts, sourceChecksums,
    nodeRecords: nodeAudit.records, nodeRegistrations,
    records: records.map(({ motif: _motif, ...record }) => record),
    findings, operations,
  };
  return Object.freeze({
    ...planBody,
    sourceCounts: Object.freeze(sourceCounts), sourceChecksums: Object.freeze(sourceChecksums),
    nodeRecords: nodeAudit.records, nodeRegistrations,
    records: Object.freeze(records), findings: Object.freeze(findings), operations: Object.freeze(operations),
    planChecksum: `sha256:${semanticHash(planBody)}`,
    audit: completeAudit,
  });
}

function assertCheckpointParity(checkpoint, plan) {
  for (const source of RESEARCH_GRAPH_BACKFILL_SOURCES) {
    if (checkpoint.sourceCounts[source] !== plan.sourceCounts[source]
      || checkpoint.sourceChecksums[source] !== plan.sourceChecksums[source]) {
      throw new ResearchGraphBackfillError(`checkpoint parity failed for ${source}`, 'RESEARCH_GRAPH_BACKFILL_PARITY_MISMATCH', 409);
    }
  }
}

async function assertDurableStagingMatchesCurrentSnapshot(repository, { projectId, pageSize, staged }) {
  // An exported PostgreSQL snapshot cannot survive a stopped process. On
  // resume, re-read every source under the new run's consistent snapshot so
  // inserts, deletes, or edits behind an already-durable cursor cannot evade
  // count/checksum parity.
  const current = await scanDryRun(repository, { projectId, pageSize });
  for (const source of RESEARCH_GRAPH_BACKFILL_SOURCES) {
    const durableParity = sourceParity(staged.filter((row) => row.source === source));
    const currentParity = sourceParity(current.filter((row) => row.source === source));
    if (durableParity.count !== currentParity.count || durableParity.checksum !== currentParity.checksum) {
      throw new ResearchGraphBackfillError(`legacy source changed across checkpoint snapshots: ${source}`, 'RESEARCH_GRAPH_BACKFILL_SOURCE_CONFLICT', 409);
    }
  }
}

async function applyPlan(repository, { checkpoint, plan, now }) {
  const blocked = plan.audit.records.some((record) => record.status === 'quarantined')
    || plan.audit.findings.some((finding) => finding.status === 'active' && finding.severity === 'blocking');
  return repository.withTransaction(async (transaction) => {
    const operationByMapping = new Map(plan.operations.map((operation) => [operation.mappingId, operation]));
    const nodeRecordByMapping = new Map(plan.nodeRecords.map((record) => [record.mappingId, record]));
    const registeredRefs = new Set(plan.nodeRegistrations.map((registration) => `${registration.ref.kind}:${registration.ref.id}@${registration.ref.revision}`));
    for (const registration of plan.nodeRegistrations) {
      const record = nodeRecordByMapping.get(registration.mappingId);
      const existing = await transaction.getLegacyNodeRecord(record.sourceKind, record.sourceId, record.sourceRevision);
      if (existing && existing.sourceChecksum !== record.sourceChecksum) throw new ResearchGraphBackfillError(`legacy node changed before apply: ${record.sourceKey}`, 'RESEARCH_GRAPH_BACKFILL_SOURCE_CONFLICT', 409);
      if (!existing) {
        await transaction.materializeLegacyResearchNode({ record, registration });
        await transaction.insertLegacyNodeRecord(record);
      }
    }
    for (const record of plan.nodeRecords.filter((entry) => entry.status !== 'mapped')) {
      const existing = await transaction.getLegacyNodeRecord(record.sourceKind, record.sourceId, record.sourceRevision);
      if (existing && existing.sourceChecksum !== record.sourceChecksum) throw new ResearchGraphBackfillError(`legacy node changed before archive: ${record.sourceKey}`, 'RESEARCH_GRAPH_BACKFILL_SOURCE_CONFLICT', 409);
      if (!existing) await transaction.insertLegacyNodeRecord(record);
    }
    // Challenge revisions are kernel vertices and their immutable lineage must
    // exist before an impact can point at them. Source keys sort lexically
    // (`@10` before `@2`), so use an explicit numeric lineage order for apply.
    const recordsForApply = [...plan.records].sort((left, right) => {
      const leftPriority = left.source === 'challenge_revision' ? 0 : left.source === 'challenge_impact' ? 1 : 2;
      const rightPriority = right.source === 'challenge_revision' ? 0 : right.source === 'challenge_impact' ? 1 : 2;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      if (left.source === 'challenge_revision' && right.source === 'challenge_revision') {
        const leftPayload = left.sourcePayload ?? {};
        const rightPayload = right.sourcePayload ?? {};
        const idOrder = String(value(leftPayload, 'challengeId', 'challenge_id')).localeCompare(String(value(rightPayload, 'challengeId', 'challenge_id')));
        if (idOrder !== 0) return idOrder;
        return Number(value(leftPayload, 'challengeRevision', 'challenge_revision', 'revision'))
          - Number(value(rightPayload, 'challengeRevision', 'challenge_revision', 'revision'));
      }
      return `${left.source}:${left.sourceKey}`.localeCompare(`${right.source}:${right.sourceKey}`);
    });
    for (const record of recordsForApply) {
      const existing = await transaction.getLegacyRelationRecord(record.source, record.sourceKey);
      if (existing && existing.sourceChecksum !== record.sourceChecksum) throw new ResearchGraphBackfillError(`legacy source changed before apply: ${record.source}:${record.sourceKey}`, 'RESEARCH_GRAPH_BACKFILL_SOURCE_CONFLICT', 409);
      if (existing) continue;
      const operation = operationByMapping.get(record.mappingId);
      if (operation?.operation === 'edge') {
        const targetKey = operation.registerTarget && `${operation.registerTarget.kind}:${operation.registerTarget.id}@${operation.registerTarget.revision}`;
        if (operation.registerTarget && !registeredRefs.has(targetKey)) await transaction.materializeLegacyChallengeRevision({ record, ref: operation.registerTarget });
        await transaction.materializeLegacyResearchEdge({ record, edgeId: operation.edgeId, edge: operation.edge });
      } else if (operation?.operation === 'motif') {
        await transaction.materializeLegacyResearchMotif({ record, operation });
      }
      const { motif: _motif, ...persisted } = record;
      await transaction.insertLegacyRelationRecord(persisted);
    }
    // Findings may reference legacy_relation_records; persist their immutable
    // source record first so the database FK is satisfied in the same batch.
    for (const finding of plan.findings) {
      if (!await transaction.getResearchGraphMigrationFinding(finding.findingId)) await transaction.insertResearchGraphMigrationFinding(finding);
    }
    const phase = blocked ? 'blocked' : 'complete';
    const updated = nextCheckpoint(checkpoint, {
      phase, planChecksum: plan.planChecksum,
      completedAt: phase === 'complete' ? now() : null,
    }, now);
    return await transaction.updateResearchGraphBackfillCheckpoint(updated) ?? updated;
  });
}

/**
 * Scan, stage, audit, and atomically materialize the legacy relationship graph.
 * Repository implementations own SQL and event preservation; this service owns
 * deterministic paging, checkpoint recovery, parity, mapping, and cutover gates.
 */
export async function runResearchGraphBackfill({
  repository, projectId, pageSize = 100, dryRun = false, now = () => new Date().toISOString(),
} = {}) {
  projectId = requiredText(projectId, 'backfill project id');
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new ResearchGraphBackfillError('pageSize must be an integer from 1 to 1000');
  if (typeof now !== 'function') throw new ResearchGraphBackfillError('now must be a function');
  assertRepository(repository, { dryRun });

  if (!dryRun) {
    const existing = await repository.getResearchGraphBackfillCheckpoint(projectId);
    if (existing && validateCheckpoint(existing, projectId).phase === 'complete') return Object.freeze({ dryRun: false, noOp: true, checkpoint: existing, cutoverReady: true });
  }

  let checkpoint = dryRun ? null : await ensureCheckpoint(repository, projectId, now);
  let staged;
  if (dryRun) staged = await scanDryRun(repository, { projectId, pageSize });
  else {
    ({ checkpoint, staged } = await scanWithCheckpoint(repository, { projectId, pageSize, checkpoint, now }));
    await assertDurableStagingMatchesCurrentSnapshot(repository, { projectId, pageSize, staged });
  }

  let knownRevisionRefs = await repository.listKnownResearchNodeRevisionRefs({ projectId });
  if (!Array.isArray(knownRevisionRefs)) throw new ResearchGraphBackfillError('listKnownResearchNodeRevisionRefs must return an array');
  knownRevisionRefs = knownRevisionRefs.map((ref) => normalizeNodeRevisionRef(ref));
  const plan = buildPlan({ projectId, staged, knownRevisionRefs });
  if (dryRun) {
    let cutoverReady = true;
    try { assertResearchGraphCutoverReady({ audit: plan.audit, expectedUniqueSourceCount: staged.length }); } catch { cutoverReady = false; }
    return Object.freeze({ dryRun: true, noOp: false, plan, audit: plan.audit, cutoverReady });
  }

  assertCheckpointParity(checkpoint, plan);
  if (checkpoint.planChecksum && checkpoint.planChecksum !== plan.planChecksum) throw new ResearchGraphBackfillError('checkpoint plan checksum changed', 'RESEARCH_GRAPH_BACKFILL_PLAN_CONFLICT', 409);
  checkpoint = await repository.withTransaction(async (transaction) => {
    const updated = nextCheckpoint(checkpoint, { phase: 'applying', planChecksum: plan.planChecksum }, now);
    return await transaction.updateResearchGraphBackfillCheckpoint(updated) ?? updated;
  });
  checkpoint = await applyPlan(repository, { checkpoint, plan, now });
  const result = Object.freeze({ dryRun: false, noOp: false, checkpoint, plan, audit: plan.audit, cutoverReady: checkpoint.phase === 'complete' });
  if (result.cutoverReady) assertResearchGraphCutoverReady({ audit: plan.audit, expectedUniqueSourceCount: staged.length });
  return result;
}

export function assertResearchGraphBackfillCutoverReady(result) {
  if (!result || result.cutoverReady !== true || result.checkpoint?.phase !== 'complete') {
    throw new ResearchGraphMigrationError('backfill checkpoint is not complete', 'RESEARCH_GRAPH_CUTOVER_BLOCKED', 409);
  }
  // A repeat invocation intentionally returns the already-gated durable
  // checkpoint without rebuilding a plan or touching legacy sources.
  if (result.noOp === true && result.audit === undefined) return true;
  assertResearchGraphCutoverReady({ audit: result.audit, expectedUniqueSourceCount: result.audit.sourceCount });
  return true;
}

export const RESEARCH_GRAPH_BACKFILL_REPOSITORY_METHODS = Object.freeze({
  transaction: Object.freeze(['withTransaction']),
  scanners: Object.freeze(Object.values(SOURCE_CONFIG).map(({ scan }) => scan)),
  inventory: Object.freeze(['listKnownResearchNodeRevisionRefs']),
  checkpoint: Object.freeze(['getResearchGraphBackfillCheckpoint', 'insertResearchGraphBackfillCheckpoint', 'updateResearchGraphBackfillCheckpoint']),
  staging: Object.freeze(['getResearchGraphBackfillStaging', 'insertResearchGraphBackfillStaging', 'listResearchGraphBackfillStaging']),
  audit: Object.freeze(['getLegacyRelationRecord', 'insertLegacyRelationRecord', 'getLegacyNodeRecord', 'insertLegacyNodeRecord', 'getResearchGraphMigrationFinding', 'insertResearchGraphMigrationFinding']),
  apply: Object.freeze(['materializeLegacyResearchNode', 'materializeLegacyResearchEdge', 'materializeLegacyResearchMotif', 'materializeLegacyChallengeRevision']),
});
