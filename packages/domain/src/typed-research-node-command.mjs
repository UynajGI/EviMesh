import { canonicalJson, semanticHash } from '../../protocol/src/hash.mjs';
import {
  EVALUATION_STANCES,
  RESEARCH_DOCUMENT_STATES,
  TOOL_KINDS,
  assertForwardResearchEdge,
  normalizeNodeRevisionRef,
  normalizeResearchRevisionLineage,
} from '../../protocol/src/research-graph.mjs';
import { assertProjectRoleForAction } from './project-authorization.mjs';

const DOCUMENT_STATE_SET = new Set(RESEARCH_DOCUMENT_STATES);
const EVALUATION_STANCE_SET = new Set(EVALUATION_STANCES);
const TOOL_KIND_SET = new Set(TOOL_KINDS);
const GRAPH_VERSION = 'research-graph.v1';

export class TypedResearchNodeCommandError extends Error {
  constructor(message, code = 'RESEARCH_NODE_INVALID', status = 400) {
    super(message);
    this.name = 'TypedResearchNodeCommandError';
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypedResearchNodeCommandError(`${field} must be a non-empty string`);
  return value.trim();
}

function optionalText(value, field) {
  return value === null || value === undefined ? null : requiredText(value, field);
}

function positiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypedResearchNodeCommandError(`${field} must be a positive safe integer`);
  return value;
}

function documentState(value) {
  value = requiredText(value, 'research node state');
  if (!DOCUMENT_STATE_SET.has(value)) throw new TypedResearchNodeCommandError(`unsupported research node state: ${value}`);
  return value;
}

function textList(value, field) {
  if (!Array.isArray(value)) throw new TypedResearchNodeCommandError(`${field} must be an array`);
  const normalized = value.map((entry, index) => requiredText(entry, `${field}[${index}]`));
  if (new Set(normalized).size !== normalized.length) throw new TypedResearchNodeCommandError(`${field} must contain unique values`);
  return Object.freeze(normalized);
}

function publisherEnvelope(value) {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypedResearchNodeCommandError('publisher signature envelope must be a JSON object or null');
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    if (error instanceof TypedResearchNodeCommandError) throw error;
    throw new TypedResearchNodeCommandError(`publisher signature envelope is not JSON-compatible: ${error.message}`);
  }
}

function nodeRef(value, field, allowedKinds = null) {
  try {
    const normalized = normalizeNodeRevisionRef(value, field);
    if (allowedKinds && !allowedKinds.includes(normalized.kind)) throw new TypeError(`${field} kind must be one of ${allowedKinds.join(', ')}`);
    return normalized;
  } catch (error) {
    throw new TypedResearchNodeCommandError(error.message);
  }
}

function uniqueRefs(value, field, allowedKinds = null) {
  if (!Array.isArray(value)) throw new TypedResearchNodeCommandError(`${field} must be an array`);
  const normalized = value.map((entry, index) => nodeRef(entry, `${field}[${index}]`, allowedKinds));
  const keys = normalized.map((ref) => `${ref.kind}:${ref.id}@${ref.revision}`);
  if (new Set(keys).size !== keys.length) throw new TypedResearchNodeCommandError(`${field} must contain unique revision refs`);
  return Object.freeze(normalized);
}

function normalizedEventId(event) {
  return requiredText(event?.eventId ?? event?.event_id, 'research node source event id');
}

function assertEventBindsPayload(event, payload) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new TypedResearchNodeCommandError('eventFactory must return an event object');
  normalizedEventId(event);
  if (event.payload !== undefined && canonicalJson(event.payload) !== canonicalJson(payload)) {
    throw new TypedResearchNodeCommandError('signed event payload does not bind the complete research revision and incoming edges', 'RESEARCH_EVENT_PAYLOAD_MISMATCH');
  }
  return event;
}

function edgeId(type, source, target) {
  return `edge_${semanticHash({ schema: 'evimesh.research-edge.v1', type, source, target })}`;
}

function contentHash({ kind, nodeId, projectId, revision, supersedesRevision, state, typedContent, incomingEdges, commitRank, batchRank }) {
  return `sha256:${semanticHash({
    schema: 'evimesh.research-node-revision.v1', graphVersion: GRAPH_VERSION,
    kind, nodeId, projectId, revision, supersedesRevision, state, typedContent,
    incomingEdges: incomingEdges.map(({ type, source, target }) => ({ type, source, target })),
    commitRank, batchRank,
  })}`;
}

function assertRepository(repository, typedInsertMethod, { evaluation = false } = {}) {
  if (!repository || typeof repository.withTransaction !== 'function') throw new TypedResearchNodeCommandError('repository withTransaction is required');
  const methods = [
    'allocateResearchCommitRank', 'getResearchNode', 'getResearchNodeRevision', 'insertResearchNode',
    'insertResearchNodeRevision', 'insertResearchEdge', typedInsertMethod, 'appendResearchEvent',
  ];
  if (evaluation) methods.push('insertEvaluationBasis');
  for (const method of methods) if (typeof repository[method] !== 'function') throw new TypedResearchNodeCommandError(`repository ${method} is required`);
}

function revisionLineage(revision, supersedesRevision) {
  try {
    return normalizeResearchRevisionLineage({ revision, supersedesRevision });
  } catch (error) {
    throw new TypedResearchNodeCommandError(error.message, 'RESEARCH_REVISION_LINEAGE_INVALID');
  }
}

function assertStableNodeMatches(stableNode, { kind, nodeId, projectId }) {
  if (!stableNode || typeof stableNode !== 'object') {
    throw new TypedResearchNodeCommandError('stable research node was not found for the requested revision', 'RESEARCH_NODE_NOT_FOUND', 404);
  }
  const storedKind = stableNode.nodeKind ?? stableNode.node_kind;
  const storedId = stableNode.nodeId ?? stableNode.node_id;
  const storedProjectId = stableNode.projectId ?? stableNode.project_id;
  if (storedKind !== kind || storedId !== nodeId || storedProjectId !== projectId) {
    throw new TypedResearchNodeCommandError('stable research node identity or project does not match the requested revision', 'RESEARCH_NODE_IDENTITY_MISMATCH', 409);
  }
  if ((stableNode.retiredAt ?? stableNode.retired_at) != null) {
    throw new TypedResearchNodeCommandError('retired research nodes cannot receive another revision', 'RESEARCH_NODE_RETIRED', 409);
  }
  return stableNode;
}

function rankFromRevision(value, field) {
  if (!value || typeof value !== 'object') throw new TypedResearchNodeCommandError(`${field} was not found`, 'RESEARCH_NODE_REVISION_NOT_FOUND', 404);
  return Object.freeze({
    commitRank: positiveInteger(value.commitRank ?? value.commit_rank, `${field} commit rank`),
    batchRank: positiveInteger(value.batchRank ?? value.batch_rank, `${field} batch rank`),
  });
}

async function materializeIncomingEdges(transaction, plans, target, targetRank, eventId, actorId, actorRole) {
  const records = [];
  for (const plan of plans) {
    const sourceRecord = await transaction.getResearchNodeRevision(plan.source);
    const sourceRank = rankFromRevision(sourceRecord, `incoming ${plan.type} source`);
    try {
      assertForwardResearchEdge({ type: plan.type, source: plan.source, target, sourceRank, targetRank, actorRole });
    } catch (error) {
      throw new TypedResearchNodeCommandError(error.message, 'RESEARCH_EDGE_INVALID', 409);
    }
    records.push(Object.freeze({
      edgeId: edgeId(plan.type, plan.source, target),
      edgeType: plan.type,
      sourceKind: plan.source.kind,
      sourceId: plan.source.id,
      sourceRevision: plan.source.revision,
      sourceCommitRank: sourceRank.commitRank,
      sourceBatchRank: sourceRank.batchRank,
      targetKind: target.kind,
      targetId: target.id,
      targetRevision: target.revision,
      targetCommitRank: targetRank.commitRank,
      targetBatchRank: targetRank.batchRank,
      provenanceEventId: eventId,
      createdBy: actorId,
    }));
  }
  return Object.freeze(records);
}

async function createTypedResearchNode({
  repository, eventFactory, actorId, actorRole, projectId, kind, nodeId, state,
  label, typedContent, typedInsertMethod, typedRevision, incomingPlans,
  revision = 1, supersedesRevision = null,
  evaluationBases = null, draftedByActorId = null, publisherSignatureEnvelope = null,
}) {
  assertRepository(repository, typedInsertMethod, { evaluation: evaluationBases !== null });
  actorId = requiredText(actorId, 'actor id');
  draftedByActorId = draftedByActorId === null ? actorId : requiredText(draftedByActorId, 'drafting actor id');
  publisherSignatureEnvelope = publisherEnvelope(publisherSignatureEnvelope);
  projectId = requiredText(projectId, 'project id');
  nodeId = requiredText(nodeId, `${kind} id`);
  label = requiredText(label, `${kind} label`);
  state = documentState(state);
  ({ revision, supersedesRevision } = revisionLineage(revision, supersedesRevision));
  if (typeof eventFactory !== 'function') throw new TypedResearchNodeCommandError('eventFactory is required');
  assertProjectRoleForAction({ actorRole, requiredRole: 'contributor' });
  if (draftedByActorId !== actorId && publisherSignatureEnvelope === null) {
    throw new TypedResearchNodeCommandError('publisher signature envelope is required for agent-drafted research content', 'RESEARCH_DRAFTER_SIGNATURE_REQUIRED');
  }

  const target = Object.freeze({ kind, id: nodeId, revision });
  const previousRef = supersedesRevision === null ? null : Object.freeze({ kind, id: nodeId, revision: supersedesRevision });
  incomingPlans = previousRef === null
    ? incomingPlans
    : [{ type: 'supersedes', source: previousRef }, ...incomingPlans];
  const uniqueIncomingKeys = incomingPlans.map((plan) => `${plan.type}:${plan.source.kind}:${plan.source.id}@${plan.source.revision}`);
  if (new Set(uniqueIncomingKeys).size !== uniqueIncomingKeys.length) throw new TypedResearchNodeCommandError('incoming edges must be unique');

  return repository.withTransaction(async (transaction) => {
    if (await transaction.getResearchNodeRevision(target)) {
      throw new TypedResearchNodeCommandError('target research revision already exists; relations require a new immutable target revision', 'RESEARCH_TARGET_REVISION_EXISTS', 409);
    }
    const stableNode = await transaction.getResearchNode({ kind, id: nodeId });
    if (revision === 1) {
      if (stableNode) throw new TypedResearchNodeCommandError('stable research node already exists', 'RESEARCH_NODE_EXISTS', 409);
    } else {
      assertStableNodeMatches(stableNode, { kind, nodeId, projectId });
      if (!await transaction.getResearchNodeRevision(previousRef)) {
        throw new TypedResearchNodeCommandError('immediately previous research revision was not found', 'RESEARCH_PREVIOUS_REVISION_NOT_FOUND', 409);
      }
    }
    const commitRank = positiveInteger(await transaction.allocateResearchCommitRank(), 'allocated research commit rank');
    const targetRank = Object.freeze({ commitRank, batchRank: 1 });
    // Resolve and validate every source before asking the signer/event factory
    // to bind the exact immutable edge set.
    const provisionalEdges = await materializeIncomingEdges(transaction, incomingPlans, target, targetRank, '__pending_event__', actorId, actorRole);
    const incomingEdges = provisionalEdges.map((edge) => Object.freeze({
      type: edge.edgeType,
      source: Object.freeze({ kind: edge.sourceKind, id: edge.sourceId, revision: edge.sourceRevision }),
      target,
    }));
    const canonicalContentHash = contentHash({ kind, nodeId, projectId, revision, supersedesRevision, state, typedContent, incomingEdges, commitRank, batchRank: 1 });
    const payload = Object.freeze({
      entity_type: kind,
      entity_id: nodeId,
      project_id: projectId,
      revision,
      supersedes_revision: supersedesRevision,
      actor_id: actorId,
      signer_actor_id: actorId,
      drafted_by_actor_id: draftedByActorId,
      publisher_signature_envelope: publisherSignatureEnvelope,
      graph_version: GRAPH_VERSION,
      commit_rank: commitRank,
      batch_rank: 1,
      canonical_content_hash: canonicalContentHash,
      typed_document: typedContent,
      incoming_edges: incomingEdges,
    });
    const eventType = `${kind}.${revision === 1 ? 'created' : 'revised'}`;
    const event = assertEventBindsPayload(await eventFactory({ eventType, payload }), payload);
    const eventId = normalizedEventId(event);
    const edgeRows = provisionalEdges.map((edge) => Object.freeze({ ...edge, edgeId: edgeId(edge.edgeType, { kind: edge.sourceKind, id: edge.sourceId, revision: edge.sourceRevision }, target), provenanceEventId: eventId }));
    const node = Object.freeze({ nodeId, nodeKind: kind, projectId, createdBy: actorId });
    const revisionRecord = Object.freeze({
      nodeKind: kind, nodeId, revision, supersedesRevision,
      commitRank, batchRank: 1, canonicalContentHash, label, state,
      canonicalHref: `/${kind.replaceAll('_', '-') }s/${encodeURIComponent(nodeId)}`,
      sourceEventId: eventId, createdBy: actorId,
    });

    const persistedEvent = await transaction.appendResearchEvent(event) ?? event;
    const persistedNode = revision === 1 ? await transaction.insertResearchNode(node) ?? node : stableNode;
    const persistedRevision = await transaction.insertResearchNodeRevision(revisionRecord) ?? revisionRecord;
    const persistedTypedRevision = await transaction[typedInsertMethod](typedRevision) ?? typedRevision;
    const persistedBases = [];
    if (evaluationBases !== null) {
      for (const basis of evaluationBases) persistedBases.push(await transaction.insertEvaluationBasis(basis) ?? basis);
    }
    const persistedEdges = [];
    for (const edge of edgeRows) persistedEdges.push(await transaction.insertResearchEdge(edge) ?? edge);
    return Object.freeze({
      node: persistedNode,
      revision: persistedRevision,
      typedRevision: persistedTypedRevision,
      edges: Object.freeze(persistedEdges),
      ...(evaluationBases === null ? {} : { bases: Object.freeze(persistedBases) }),
      event: persistedEvent,
    });
  });
}

export async function createAnswer({
  repository, eventFactory, actorId, actorRole, answerId, projectId,
  draftedByActorId = actorId, publisherSignatureEnvelope = null,
  revision = 1, supersedesRevision = null,
  state = 'draft', title, synthesis, limitations = [], questionRef, additionalInputs = [],
} = {}) {
  answerId = requiredText(answerId, 'answer id');
  title = requiredText(title, 'answer title');
  synthesis = requiredText(synthesis, 'answer synthesis');
  limitations = textList(limitations, 'answer limitations');
  questionRef = nodeRef(questionRef, 'answer question ref', ['question']);
  additionalInputs = uniqueRefs(additionalInputs, 'answer additional inputs');
  const duplicate = additionalInputs.some((ref) => `${ref.kind}:${ref.id}@${ref.revision}` === `${questionRef.kind}:${questionRef.id}@${questionRef.revision}`);
  if (duplicate) throw new TypedResearchNodeCommandError('answer question ref must not be repeated as an additional input');
  const typedContent = Object.freeze({ schema: 'srp.answer.v1', title, synthesis, limitations, questionRef, additionalInputs });
  return createTypedResearchNode({
    repository, eventFactory, actorId, actorRole, projectId, kind: 'answer', nodeId: answerId, revision, supersedesRevision, state,
    label: title, typedContent, typedInsertMethod: 'insertAnswerRevision', draftedByActorId, publisherSignatureEnvelope,
    typedRevision: Object.freeze({ answerId, revision, nodeKind: 'answer', title, synthesis, limitations }),
    incomingPlans: [{ type: 'answers', source: questionRef }, ...additionalInputs.map((source) => ({ type: 'derived_from', source }))],
  });
}

export async function createRebuttal({
  repository, eventFactory, actorId, actorRole, rebuttalId, projectId,
  draftedByActorId = actorId, publisherSignatureEnvelope = null,
  revision = 1, supersedesRevision = null,
  state = 'draft', title, argument, scope = [], targetRef, basisRefs = [],
} = {}) {
  rebuttalId = requiredText(rebuttalId, 'rebuttal id');
  title = requiredText(title, 'rebuttal title');
  argument = requiredText(argument, 'rebuttal argument');
  scope = textList(scope, 'rebuttal scope');
  targetRef = nodeRef(targetRef, 'rebuttal target ref', ['answer', 'claim']);
  basisRefs = uniqueRefs(basisRefs, 'rebuttal basis refs', ['claim', 'evidence', 'run', 'dataset', 'artifact']);
  const typedContent = Object.freeze({ schema: 'srp.rebuttal.v1', title, argument, scope, targetRef, basisRefs });
  return createTypedResearchNode({
    repository, eventFactory, actorId, actorRole, projectId, kind: 'rebuttal', nodeId: rebuttalId, revision, supersedesRevision, state,
    label: title, typedContent, typedInsertMethod: 'insertRebuttalRevision', draftedByActorId, publisherSignatureEnvelope,
    typedRevision: Object.freeze({ rebuttalId, revision, nodeKind: 'rebuttal', title, argument, scope }),
    incomingPlans: [{ type: 'rebuts', source: targetRef }, ...basisRefs.map((source) => ({ type: 'grounds_rebuttal', source }))],
  });
}

export async function createEvaluation({
  repository, eventFactory, actorId, actorRole, evaluationId, projectId,
  draftedByActorId = actorId, publisherSignatureEnvelope = null,
  revision = 1, supersedesRevision = null,
  state = 'draft', subjectRef, basisRefs, stance, rationale, method = null,
} = {}) {
  evaluationId = requiredText(evaluationId, 'evaluation id');
  subjectRef = nodeRef(subjectRef, 'evaluation subject ref', ['claim']);
  basisRefs = uniqueRefs(basisRefs, 'evaluation basis refs', ['claim', 'evidence', 'run', 'dataset', 'artifact']);
  if (basisRefs.length === 0) throw new TypedResearchNodeCommandError('evaluation requires at least one basis ref');
  stance = requiredText(stance, 'evaluation stance');
  if (!EVALUATION_STANCE_SET.has(stance)) throw new TypedResearchNodeCommandError(`unsupported evaluation stance: ${stance}`);
  rationale = requiredText(rationale, 'evaluation rationale');
  method = optionalText(method, 'evaluation method');
  const typedContent = Object.freeze({ schema: 'srp.evaluation.v1', subjectRef, basisRefs, stance, rationale, method });
  return createTypedResearchNode({
    repository, eventFactory, actorId, actorRole, projectId, kind: 'evaluation', nodeId: evaluationId, revision, supersedesRevision, state,
    label: `${stance}: ${subjectRef.id}`, typedContent, typedInsertMethod: 'insertEvaluationRevision', draftedByActorId, publisherSignatureEnvelope,
    typedRevision: Object.freeze({ evaluationId, revision, nodeKind: 'evaluation', subjectKind: subjectRef.kind, subjectId: subjectRef.id, subjectRevision: subjectRef.revision, stance, rationale, method }),
    evaluationBases: basisRefs.map((basis) => Object.freeze({ evaluationId, evaluationRevision: revision, basisKind: basis.kind, basisId: basis.id, basisRevision: basis.revision })),
    incomingPlans: [{ type: 'evaluates', source: subjectRef }, ...basisRefs.map((source) => ({ type: 'evaluation_basis', source }))],
  });
}

export async function createDataset({
  repository, eventFactory, actorId, actorRole, datasetId, projectId,
  draftedByActorId = actorId, publisherSignatureEnvelope = null,
  revision = 1, supersedesRevision = null,
  state = 'draft', name, description, version, license, schemaUri = null, provenance, artifactRef,
} = {}) {
  datasetId = requiredText(datasetId, 'dataset id');
  name = requiredText(name, 'dataset name');
  description = requiredText(description, 'dataset description');
  version = requiredText(version, 'dataset version');
  license = requiredText(license, 'dataset license');
  schemaUri = optionalText(schemaUri, 'dataset schema URI');
  provenance = requiredText(provenance, 'dataset provenance');
  artifactRef = nodeRef(artifactRef, 'dataset artifact ref', ['artifact']);
  const typedContent = Object.freeze({ schema: 'srp.dataset.v1', name, description, version, license, schemaUri, provenance, artifactRef });
  return createTypedResearchNode({
    repository, eventFactory, actorId, actorRole, projectId, kind: 'dataset', nodeId: datasetId, revision, supersedesRevision, state,
    label: name, typedContent, typedInsertMethod: 'insertDatasetRevision', draftedByActorId, publisherSignatureEnvelope,
    typedRevision: Object.freeze({ datasetId, revision, nodeKind: 'dataset', name, description, version, license, schemaUri, provenance, artifactKind: 'artifact', artifactId: artifactRef.id, artifactRevision: artifactRef.revision }),
    incomingPlans: [{ type: 'materializes_dataset', source: artifactRef }],
  });
}

export async function createTool({
  repository, eventFactory, actorId, actorRole, toolId, projectId,
  draftedByActorId = actorId, publisherSignatureEnvelope = null,
  revision = 1, supersedesRevision = null,
  state = 'draft', name, description, toolKind, version, runtime,
  inputSchemaUri = null, outputSchemaUri = null, license, provenance, artifactRef = null,
} = {}) {
  toolId = requiredText(toolId, 'tool id');
  name = requiredText(name, 'tool name');
  description = requiredText(description, 'tool description');
  toolKind = requiredText(toolKind, 'tool kind');
  if (!TOOL_KIND_SET.has(toolKind)) throw new TypedResearchNodeCommandError(`unsupported tool kind: ${toolKind}`);
  version = requiredText(version, 'tool version');
  runtime = requiredText(runtime, 'tool runtime');
  inputSchemaUri = optionalText(inputSchemaUri, 'tool input schema URI');
  outputSchemaUri = optionalText(outputSchemaUri, 'tool output schema URI');
  license = requiredText(license, 'tool license');
  provenance = requiredText(provenance, 'tool provenance');
  artifactRef = artifactRef === null ? null : nodeRef(artifactRef, 'tool artifact ref', ['artifact']);
  const typedContent = Object.freeze({ schema: 'srp.tool.v1', name, description, toolKind, version, runtime, inputSchemaUri, outputSchemaUri, license, provenance, artifactRef });
  return createTypedResearchNode({
    repository, eventFactory, actorId, actorRole, projectId, kind: 'tool', nodeId: toolId, revision, supersedesRevision, state,
    label: name, typedContent, typedInsertMethod: 'insertToolRevision', draftedByActorId, publisherSignatureEnvelope,
    typedRevision: Object.freeze({
      toolId, revision, nodeKind: 'tool', name, description, toolKind, version, runtime,
      inputSchemaUri, outputSchemaUri, license, provenance,
      artifactKind: artifactRef?.kind ?? null, artifactId: artifactRef?.id ?? null, artifactRevision: artifactRef?.revision ?? null,
    }),
    incomingPlans: artifactRef === null ? [] : [{ type: 'packages_tool', source: artifactRef }],
  });
}
