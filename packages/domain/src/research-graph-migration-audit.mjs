import { canonicalJson, semanticHash } from '../../protocol/src/hash.mjs';
import {
  legacyChallengeImpactMotif,
  legacyChallengeRevisionMotif,
  legacyClaimRelationMotif,
  legacyEvidenceClaimMotif,
  legacyRunInputMotif,
  legacyRunOutputMotif,
  legacyTaskDependencyMotif,
  normalizeNodeRevisionRef,
} from '../../protocol/src/research-graph.mjs';

export class ResearchGraphMigrationError extends Error {
  constructor(message, code = 'RESEARCH_GRAPH_MIGRATION_INVALID', status = 400) {
    super(message);
    this.name = 'ResearchGraphMigrationError';
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new ResearchGraphMigrationError(`${field} must be a non-empty string`);
  return value.trim();
}

function positiveInteger(value, field, fallback = null) {
  if (value === undefined && fallback !== null) return fallback;
  if (!Number.isSafeInteger(value) || value < 1) throw new ResearchGraphMigrationError(`${field} must be a positive safe integer`);
  return value;
}

function assertPlainJson(value, seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('non-finite number');
    return;
  }
  if (typeof value !== 'object') throw new TypeError(`unsupported ${typeof value}`);
  if (seen.has(value)) throw new TypeError('cyclic value');
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new TypeError('non-plain object; repository must encode dates and binary signature bytes explicitly');
  }
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) assertPlainJson(item, seen);
  } else {
    for (const item of Object.values(value)) assertPlainJson(item, seen);
  }
  seen.delete(value);
}

function cloneJson(value, field) {
  try {
    assertPlainJson(value);
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    throw new ResearchGraphMigrationError(`${field} must be JSON-compatible: ${error.message}`);
  }
}

function refKey(ref) {
  return `${ref.kind}:${ref.id}@${ref.revision}`;
}

function edgeId(edge) {
  return `edge_${semanticHash({ schema: 'evimesh.research-edge.v1', ...edge })}`;
}

function deterministicObjectId(kind, mappingKey) {
  const hash = semanticHash({ schema: 'evimesh.legacy-motif-node.v1', kind, mappingKey });
  const uuid = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  return `${kind}_${uuid}`;
}

function normalizeClaimRow(row) {
  const relationType = requiredText(row?.relationType ?? row?.relation_type ?? row?.type, 'legacy Claim relation type');
  const sourceClaimId = requiredText(row?.sourceClaimId ?? row?.source_claim_id ?? row?.source, 'legacy Claim relation source');
  const targetClaimId = requiredText(row?.targetClaimId ?? row?.target_claim_id ?? row?.target, 'legacy Claim relation target');
  const sourceRevision = positiveInteger(row?.sourceRevision ?? row?.source_revision, 'legacy Claim relation source revision');
  const targetRevision = positiveInteger(row?.targetRevision ?? row?.target_revision, 'legacy Claim relation target revision');
  return Object.freeze({ relationType, sourceClaimId, targetClaimId, sourceRevision, targetRevision });
}

function normalizeEvidenceRow(row) {
  const relationType = requiredText(row?.relationType ?? row?.relation_type ?? row?.type, 'legacy Evidence relation type');
  const evidenceId = requiredText(row?.evidenceId ?? row?.evidence_id, 'legacy Evidence id');
  const claimId = requiredText(row?.claimId ?? row?.claim_id, 'legacy Evidence Claim id');
  const claimRevision = positiveInteger(row?.claimRevision ?? row?.claim_revision, 'legacy Evidence Claim revision');
  return Object.freeze({ relationType, evidenceId, claimId, claimRevision });
}

function normalizeChallengeRevisionRow(row) {
  return Object.freeze({
    challengeId: requiredText(row?.challengeId ?? row?.challenge_id, 'legacy Challenge id'),
    challengeRevision: positiveInteger(row?.challengeRevision ?? row?.challenge_revision ?? row?.revision, 'legacy Challenge revision'),
    targetClaimId: requiredText(row?.targetClaimId ?? row?.target_claim_id, 'legacy Challenge target Claim id'),
    targetClaimRevision: positiveInteger(row?.targetClaimRevision ?? row?.target_claim_revision, 'legacy Challenge target Claim revision'),
  });
}

function normalizeChallengeImpactRow(row) {
  return Object.freeze({
    impactId: requiredText(row?.impactId ?? row?.impact_id, 'legacy Challenge impact id'),
    challengeId: requiredText(row?.challengeId ?? row?.challenge_id, 'legacy Challenge impact Challenge id'),
    challengeRevision: positiveInteger(row?.challengeRevision ?? row?.challenge_revision, 'legacy Challenge impact Challenge revision'),
    claimId: requiredText(row?.claimId ?? row?.claim_id, 'legacy Challenge impact Claim id'),
    claimRevision: positiveInteger(row?.claimRevision ?? row?.claim_revision, 'legacy Challenge impact Claim revision'),
    impactType: requiredText(row?.impactType ?? row?.impact_type, 'legacy Challenge impact type'),
  });
}

function normalizeTaskDependencyRow(row) {
  return Object.freeze({
    sourceTaskId: requiredText(row?.sourceTaskId ?? row?.source_task_id, 'legacy dependent Task id'),
    sourceTaskRevision: positiveInteger(row?.sourceTaskRevision ?? row?.source_task_revision, 'legacy dependent Task revision'),
    targetTaskId: requiredText(row?.targetTaskId ?? row?.target_task_id, 'legacy prerequisite Task id'),
    targetTaskRevision: positiveInteger(row?.targetTaskRevision ?? row?.target_task_revision, 'legacy prerequisite Task revision'),
  });
}

function normalizeRunArtifactRow(row, direction) {
  return Object.freeze({
    runId: requiredText(row?.runId ?? row?.run_id, `legacy Run ${direction} Run id`),
    runRevision: positiveInteger(row?.runRevision ?? row?.run_revision, `legacy Run ${direction} Run revision`, 1),
    artifactId: requiredText(row?.artifactId ?? row?.artifact_id, `legacy Run ${direction} Artifact id`),
    artifactRevision: positiveInteger(row?.artifactRevision ?? row?.artifact_revision, `legacy Run ${direction} Artifact revision`),
  });
}

function recordForMotif({ projectId, source, sourceKey, payload, motif }) {
  const sourcePayload = cloneJson(payload, 'legacy relation payload');
  const base = {
    mappingId: motif.mappingKey,
    projectId,
    source,
    sourceKey,
    sourcePayload,
    sourceChecksum: `sha256:${semanticHash(sourcePayload)}`,
    mappingKind: motif.motif,
    status: 'mapped',
    mappedNodeKind: null,
    mappedNodeId: null,
    mappedNodeRevision: null,
    mappedEdgeId: null,
    motif,
  };
  if (motif.motif === 'direct') base.mappedEdgeId = edgeId(motif.edge);
  if (motif.motif === 'evaluation' || motif.motif === 'rebuttal') {
    base.mappedNodeKind = motif.motif;
    base.mappedNodeId = deterministicObjectId(motif.motif, motif.mappingKey);
    base.mappedNodeRevision = 1;
  }
  return base;
}

function archiveDeletedRecord(record) {
  return {
    ...record,
    mappingKind: 'archive',
    status: 'archived',
    mappedNodeKind: null,
    mappedNodeId: null,
    mappedNodeRevision: null,
    mappedEdgeId: null,
  };
}

function stronglyConnectedComponents(edges) {
  const adjacency = new Map();
  for (const edge of edges) {
    const source = refKey(edge.source);
    const target = refKey(edge.target);
    if (!adjacency.has(source)) adjacency.set(source, []);
    if (!adjacency.has(target)) adjacency.set(target, []);
    adjacency.get(source).push(target);
  }
  for (const neighbors of adjacency.values()) neighbors.sort();
  const indices = new Map();
  const lowlinks = new Map();
  const stack = [];
  const stacked = new Set();
  const components = [];
  let index = 0;

  function visit(vertex) {
    indices.set(vertex, index);
    lowlinks.set(vertex, index);
    index += 1;
    stack.push(vertex);
    stacked.add(vertex);
    for (const neighbor of adjacency.get(vertex) ?? []) {
      if (!indices.has(neighbor)) {
        visit(neighbor);
        lowlinks.set(vertex, Math.min(lowlinks.get(vertex), lowlinks.get(neighbor)));
      } else if (stacked.has(neighbor)) {
        lowlinks.set(vertex, Math.min(lowlinks.get(vertex), indices.get(neighbor)));
      }
    }
    if (lowlinks.get(vertex) === indices.get(vertex)) {
      const component = [];
      let member;
      do {
        member = stack.pop();
        stacked.delete(member);
        component.push(member);
      } while (member !== vertex);
      components.push(component.sort());
    }
  }

  for (const vertex of [...adjacency.keys()].sort()) if (!indices.has(vertex)) visit(vertex);
  return components;
}

function finding({ projectId, findingType, members, details, legacyMappingId = null }) {
  const memberRefs = [...members].sort();
  return Object.freeze({
    findingId: `finding_${semanticHash({ schema: 'evimesh.research-graph-migration-finding.v1', projectId, findingType, memberRefs, legacyMappingId })}`,
    projectId,
    findingType,
    severity: 'blocking',
    status: 'active',
    memberRefs: Object.freeze(memberRefs),
    details,
    legacyMappingId,
    resolvedAt: null,
    resolvedBy: null,
  });
}

function motifRefs(motif) {
  if (motif.motif === 'direct') return [motif.edge.source, motif.edge.target];
  return [motif.subject, ...motif.bases];
}

/**
 * Build a deterministic, reversible audit plan. It never deletes, reverses,
 * or silently drops a legacy relation; every source row is mapped or archived.
 */
export function auditLegacyResearchGraph({
  projectId,
  claimRelations = [],
  evidenceClaimLinks = [],
  challengeRevisions = [],
  challengeImpacts = [],
  taskDependencies = [],
  knownRevisionRefs = null,
  runInputs = [],
  runOutputs = [],
} = {}) {
  projectId = requiredText(projectId, 'migration project id');
  if (![claimRelations, evidenceClaimLinks, challengeRevisions, challengeImpacts, taskDependencies, runInputs, runOutputs].every(Array.isArray)) {
    throw new ResearchGraphMigrationError('legacy relation collections must be arrays');
  }
  const records = [];
  for (const raw of claimRelations) {
    const row = normalizeClaimRow(raw);
    const motif = legacyClaimRelationMotif(row);
    const record = recordForMotif({
      projectId,
      source: 'claim_relation',
      sourceKey: `${row.sourceClaimId}@${row.sourceRevision}|${row.relationType}|${row.targetClaimId}@${row.targetRevision}`,
      payload: raw,
      motif,
    });
    records.push((raw?.deletedAt ?? raw?.deleted_at) ? archiveDeletedRecord(record) : record);
  }
  for (const raw of evidenceClaimLinks) {
    const row = normalizeEvidenceRow(raw);
    const motif = legacyEvidenceClaimMotif(row);
    const record = recordForMotif({
      projectId,
      source: 'evidence_claim_link',
      sourceKey: `${row.evidenceId}|${row.relationType}|${row.claimId}@${row.claimRevision}`,
      payload: raw,
      motif,
    });
    records.push((raw?.deletedAt ?? raw?.deleted_at) ? archiveDeletedRecord(record) : record);
  }
  for (const raw of challengeRevisions) {
    const row = normalizeChallengeRevisionRow(raw);
    const motif = legacyChallengeRevisionMotif(row);
    const record = recordForMotif({
      projectId, source: 'challenge_revision',
      sourceKey: `${row.challengeId}@${row.challengeRevision}`,
      payload: raw, motif,
    });
    records.push((raw?.deletedAt ?? raw?.deleted_at) ? archiveDeletedRecord(record) : record);
  }
  for (const raw of challengeImpacts) {
    const row = normalizeChallengeImpactRow(raw);
    const motif = legacyChallengeImpactMotif(row);
    const record = recordForMotif({
      projectId, source: 'challenge_impact', sourceKey: row.impactId, payload: raw, motif,
    });
    records.push((raw?.deletedAt ?? raw?.deleted_at) ? archiveDeletedRecord(record) : record);
  }
  for (const raw of taskDependencies) {
    const row = normalizeTaskDependencyRow(raw);
    const motif = legacyTaskDependencyMotif(row);
    const record = recordForMotif({
      projectId, source: 'task_dependency',
      sourceKey: `${row.sourceTaskId}@${row.sourceTaskRevision}|${row.targetTaskId}@${row.targetTaskRevision}`,
      payload: raw, motif,
    });
    records.push((raw?.deletedAt ?? raw?.deleted_at) ? archiveDeletedRecord(record) : record);
  }
  for (const raw of runInputs) {
    const row = normalizeRunArtifactRow(raw, 'input');
    records.push(recordForMotif({
      projectId, source: 'run_input',
      sourceKey: `${row.runId}@${row.runRevision}|${row.artifactId}@${row.artifactRevision}`,
      payload: raw, motif: legacyRunInputMotif(row),
    }));
  }
  for (const raw of runOutputs) {
    const row = normalizeRunArtifactRow(raw, 'output');
    records.push(recordForMotif({
      projectId, source: 'run_output',
      sourceKey: `${row.runId}@${row.runRevision}|${row.artifactId}@${row.artifactRevision}`,
      payload: raw, motif: legacyRunOutputMotif(row),
    }));
  }
  records.sort((left, right) => `${left.source}:${left.sourceKey}`.localeCompare(`${right.source}:${right.sourceKey}`));

  const deduplicated = [];
  for (const record of records) {
    const previous = deduplicated.at(-1);
    if (previous?.source === record.source && previous?.sourceKey === record.sourceKey) {
      if (previous.sourceChecksum !== record.sourceChecksum) throw new ResearchGraphMigrationError(`conflicting duplicate legacy relation: ${record.source}:${record.sourceKey}`, 'LEGACY_RELATION_CONFLICT', 409);
      continue;
    }
    deduplicated.push(record);
  }

  const findings = [];
  const quarantinedMappings = new Set();
  const directRecords = deduplicated.filter((record) => record.status === 'mapped' && record.motif.motif === 'direct');
  for (const record of directRecords) {
    if (refKey(record.motif.edge.source) === refKey(record.motif.edge.target)) {
      quarantinedMappings.add(record.mappingId);
      findings.push(finding({ projectId, findingType: 'self_loop', members: [refKey(record.motif.edge.source)], details: 'Legacy relation is a self-loop and cannot enter the strict DAG.', legacyMappingId: record.mappingId }));
    }
  }
  for (const component of stronglyConnectedComponents(directRecords.map((record) => record.motif.edge)).filter((members) => members.length > 1)) {
    const members = new Set(component);
    const cycleRecords = directRecords.filter((record) => members.has(refKey(record.motif.edge.source)) && members.has(refKey(record.motif.edge.target)));
    for (const record of cycleRecords) quarantinedMappings.add(record.mappingId);
    findings.push(finding({ projectId, findingType: 'cycle', members: component, details: 'The complete strongly connected legacy relation group is quarantined; no edge was deleted or reversed.', legacyMappingId: cycleRecords[0]?.mappingId ?? null }));
  }

  if (knownRevisionRefs !== null) {
    if (!Array.isArray(knownRevisionRefs)) throw new ResearchGraphMigrationError('knownRevisionRefs must be an array or null');
    const known = new Set(knownRevisionRefs.map((ref) => refKey(normalizeNodeRevisionRef(ref))));
    for (const record of deduplicated.filter((entry) => entry.status === 'mapped')) {
      const missing = motifRefs(record.motif).map(refKey).filter((key) => !known.has(key));
      if (missing.length > 0) {
        quarantinedMappings.add(record.mappingId);
        findings.push(finding({ projectId, findingType: 'dangling_revision', members: missing, details: 'Legacy relation references a revision that is absent from the migration registry.', legacyMappingId: record.mappingId }));
      }
    }
  }

  const inputs = new Set(runInputs.map((raw) => {
    const row = normalizeRunArtifactRow(raw, 'input');
    return `${row.runId}@${row.runRevision}|${row.artifactId}@${row.artifactRevision}`;
  }));
  for (const row of runOutputs) {
    const normalized = normalizeRunArtifactRow(row, 'output');
    const key = `${normalized.runId}@${normalized.runRevision}|${normalized.artifactId}@${normalized.artifactRevision}`;
    if (inputs.has(key)) findings.push(finding({ projectId, findingType: 'run_io_overlap', members: [key], details: 'The same Artifact revision is both input and output of one legacy Run.' }));
  }

  const finalRecords = deduplicated.map((record) => {
    const { motif, ...persisted } = record;
    if (!quarantinedMappings.has(record.mappingId)) return Object.freeze({ ...persisted, motif });
    return Object.freeze({
      ...persisted,
      mappingKind: 'archive',
      status: 'quarantined',
      mappedNodeKind: null,
      mappedNodeId: null,
      mappedNodeRevision: null,
      mappedEdgeId: null,
      motif,
    });
  });
  findings.sort((left, right) => left.findingId.localeCompare(right.findingId));
  return Object.freeze({
    schema: 'evimesh.research-graph-migration-audit.v1',
    projectId,
    sourceCount: records.length,
    uniqueSourceCount: finalRecords.length,
    records: Object.freeze(finalRecords),
    findings: Object.freeze(findings),
  });
}

/** Persist an audit idempotently; a changed payload under one source key fails closed. */
export async function persistLegacyResearchGraphAudit({ repository, audit } = {}) {
  if (!repository || typeof repository.withTransaction !== 'function') throw new ResearchGraphMigrationError('repository withTransaction is required');
  for (const method of ['getLegacyRelationRecord', 'insertLegacyRelationRecord', 'getResearchGraphMigrationFinding', 'insertResearchGraphMigrationFinding']) {
    if (typeof repository[method] !== 'function') throw new ResearchGraphMigrationError(`repository ${method} is required`);
  }
  if (!audit || audit.schema !== 'evimesh.research-graph-migration-audit.v1') throw new ResearchGraphMigrationError('a valid research graph migration audit is required');
  return repository.withTransaction(async (transaction) => {
    const records = [];
    for (const record of audit.records) {
      const existing = await transaction.getLegacyRelationRecord(record.source, record.sourceKey);
      if (existing && existing.sourceChecksum !== record.sourceChecksum) throw new ResearchGraphMigrationError(`legacy source changed after audit: ${record.source}:${record.sourceKey}`, 'LEGACY_RELATION_CONFLICT', 409);
      const { motif: _motif, ...persisted } = record;
      records.push(existing ?? await transaction.insertLegacyRelationRecord(persisted) ?? persisted);
    }
    const findings = [];
    for (const migrationFinding of audit.findings) {
      const existing = await transaction.getResearchGraphMigrationFinding(migrationFinding.findingId);
      findings.push(existing ?? await transaction.insertResearchGraphMigrationFinding(migrationFinding) ?? migrationFinding);
    }
    return Object.freeze({ records: Object.freeze(records), findings: Object.freeze(findings) });
  });
}

export function assertResearchGraphCutoverReady({ audit, expectedUniqueSourceCount = null } = {}) {
  if (!audit || audit.schema !== 'evimesh.research-graph-migration-audit.v1') throw new ResearchGraphMigrationError('a valid research graph migration audit is required');
  if (expectedUniqueSourceCount !== null && audit.uniqueSourceCount !== expectedUniqueSourceCount) {
    throw new ResearchGraphMigrationError('legacy relation coverage is incomplete', 'RESEARCH_GRAPH_CUTOVER_BLOCKED', 409);
  }
  if (audit.records.some((record) => record.status === 'quarantined') || audit.findings.some((entry) => entry.status === 'active' && entry.severity === 'blocking')) {
    throw new ResearchGraphMigrationError('active migration quarantine or blocking findings prevent graph cutover', 'RESEARCH_GRAPH_CUTOVER_BLOCKED', 409);
  }
  return true;
}
