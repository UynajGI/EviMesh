import { semanticHash } from './hash.mjs';

const NODE_DEFINITIONS = {
  project: { family: 'structure', label: 'Project', hrefPrefix: '/projects' },
  research_contract: { family: 'structure', label: 'Research contract', hrefPrefix: '/contracts' },
  question: { family: 'structure', label: 'Question', hrefPrefix: '/questions' },
  answer: { family: 'reasoning', label: 'Answer', hrefPrefix: '/answers' },
  claim: { family: 'reasoning', label: 'Claim', hrefPrefix: '/claims' },
  rebuttal: { family: 'reasoning', label: 'Rebuttal', hrefPrefix: '/rebuttals' },
  evaluation: { family: 'reasoning', label: 'Evaluation', hrefPrefix: '/evaluations' },
  dataset: { family: 'resource', label: 'Dataset', hrefPrefix: '/datasets' },
  tool: { family: 'resource', label: 'Tool', hrefPrefix: '/tools' },
  artifact: { family: 'resource', label: 'Artifact', hrefPrefix: '/artifacts' },
  evidence: { family: 'resource', label: 'Evidence', hrefPrefix: '/evidence' },
  task: { family: 'execution', label: 'Task', hrefPrefix: '/tasks' },
  attempt: { family: 'execution', label: 'Attempt', hrefPrefix: '/attempts' },
  context_bundle: { family: 'execution', label: 'Context bundle', hrefPrefix: '/context-bundles' },
  run: { family: 'execution', label: 'Run', hrefPrefix: '/runs' },
  verification_contract: { family: 'verification', label: 'Verification contract', hrefPrefix: '/verification-contracts' },
  verification_policy: { family: 'verification', label: 'Verification policy', hrefPrefix: '/verification-policies' },
  policy_evaluation: { family: 'verification', label: 'Policy evaluation', hrefPrefix: '/policy-evaluations' },
  verification_receipt: { family: 'verification', label: 'Verification receipt', hrefPrefix: '/verifications' },
  verification_finding: { family: 'verification', label: 'Verification finding', hrefPrefix: '/verification-findings' },
  challenge: { family: 'verification', label: 'Challenge', hrefPrefix: '/challenges' },
  merge_proposal: { family: 'verification', label: 'Merge proposal', hrefPrefix: '/merge-proposals' },
  frontier_snapshot: { family: 'verification', label: 'Frontier snapshot', hrefPrefix: '/frontier-snapshots' },
};

export const RESEARCH_NODE_DEFINITIONS = Object.freeze(Object.fromEntries(
  Object.entries(NODE_DEFINITIONS).map(([kind, definition]) => [kind, Object.freeze({ ...definition })]),
));
export const RESEARCH_NODE_KINDS = Object.freeze(Object.keys(RESEARCH_NODE_DEFINITIONS));
export const RESEARCH_NODE_FAMILIES = Object.freeze(['structure', 'reasoning', 'resource', 'execution', 'verification']);

const ANY_RESEARCH_KIND = RESEARCH_NODE_KINDS;
const REASONING_SUBJECTS = ['answer', 'claim'];
const EVALUATION_BASES = ['claim', 'evidence', 'run', 'dataset', 'artifact'];
const RUN_INPUTS = ['dataset', 'tool', 'artifact', 'context_bundle'];
const RESEARCH_AUTHORS = ['owner', 'maintainer', 'contributor'];
const ANSWER_INPUTS = ['question', 'answer', 'claim', 'dataset', 'tool', 'artifact', 'evidence', 'run', 'context_bundle'];

function pairs(sources, targets) {
  return sources.flatMap((source) => targets.map((target) => `${source}->${target}`));
}

const EDGE_DEFINITIONS = {
  extends_question: { family: 'lineage', sources: ['question'], targets: ['question'], forwardLabel: 'extends into', reverseLabel: 'extends' },
  answers: { family: 'reasoning', sources: ['question'], targets: ['answer'], forwardLabel: 'answered by', reverseLabel: 'answers' },
  yields_claim: { family: 'reasoning', sources: ['answer'], targets: ['claim'], forwardLabel: 'yields claim', reverseLabel: 'derived from answer' },
  rebuts: { family: 'challenge', sources: REASONING_SUBJECTS, targets: ['rebuttal'], forwardLabel: 'rebutted by', reverseLabel: 'rebuts' },
  grounds_rebuttal: { family: 'challenge', sources: EVALUATION_BASES, targets: ['rebuttal'], forwardLabel: 'grounds rebuttal', reverseLabel: 'grounded by' },
  evaluates: { family: 'evaluation', sources: ['claim'], targets: ['evaluation'], forwardLabel: 'evaluated by', reverseLabel: 'evaluates' },
  evaluation_basis: { family: 'evaluation', sources: EVALUATION_BASES, targets: ['evaluation'], forwardLabel: 'basis for', reverseLabel: 'based on' },
  challenges: { family: 'challenge', sources: ['claim'], targets: ['challenge'], forwardLabel: 'challenged by', reverseLabel: 'challenges' },
  uses_dataset: { family: 'resource', sources: ['dataset', 'claim'], targets: ['question', 'task', 'run', 'claim'], endpointPairs: [...pairs(['dataset'], ['question', 'task', 'run', 'claim']), 'claim->claim'], forwardLabel: 'used by', reverseLabel: 'uses dataset' },
  uses_tool: { family: 'resource', sources: ['tool', 'claim'], targets: ['question', 'task', 'run', 'claim'], endpointPairs: [...pairs(['tool'], ['question', 'task', 'run', 'claim']), 'claim->claim'], forwardLabel: 'used by', reverseLabel: 'uses tool' },
  uses_artifact: { family: 'resource', sources: ['artifact'], targets: ['question', 'task', 'run'], forwardLabel: 'used by', reverseLabel: 'uses artifact' },
  materializes_dataset: { family: 'resource', sources: ['artifact'], targets: ['dataset'], forwardLabel: 'materializes dataset', reverseLabel: 'materialized by' },
  packages_tool: { family: 'resource', sources: ['artifact'], targets: ['tool'], forwardLabel: 'packages tool', reverseLabel: 'packaged by' },
  materializes_evidence: { family: 'resource', sources: ['artifact'], targets: ['evidence'], forwardLabel: 'materializes evidence', reverseLabel: 'materialized by' },
  operationalizes: { family: 'execution', sources: ['question', 'answer', 'claim'], targets: ['task'], forwardLabel: 'operationalized as', reverseLabel: 'operationalizes' },
  attempted_as: { family: 'execution', sources: ['task'], targets: ['attempt'], forwardLabel: 'attempted as', reverseLabel: 'attempt of' },
  produces_run: { family: 'execution', sources: ['attempt'], targets: ['run'], forwardLabel: 'produces run', reverseLabel: 'run of attempt' },
  context_for: { family: 'execution', sources: ['context_bundle'], targets: ['run'], forwardLabel: 'context for', reverseLabel: 'uses context' },
  run_input: { family: 'execution', sources: RUN_INPUTS, targets: ['run'], forwardLabel: 'input to', reverseLabel: 'uses input' },
  produces_artifact: { family: 'result', sources: ['run'], targets: ['artifact'], forwardLabel: 'produces artifact', reverseLabel: 'produced by' },
  produces_evidence: { family: 'result', sources: ['run'], targets: ['evidence'], forwardLabel: 'produces evidence', reverseLabel: 'produced by' },
  verifies_claim: { family: 'verification', sources: ['claim'], targets: ['verification_receipt'], forwardLabel: 'verified by', reverseLabel: 'verifies claim' },
  verifies_run: { family: 'verification', sources: ['run'], targets: ['verification_receipt'], forwardLabel: 'verified by', reverseLabel: 'verifies run' },
  uses_verification_contract: { family: 'verification', sources: ['verification_contract'], targets: ['verification_receipt'], forwardLabel: 'governs receipt', reverseLabel: 'uses contract' },
  reports_finding: { family: 'verification', sources: ['verification_receipt'], targets: ['verification_finding'], forwardLabel: 'reports finding', reverseLabel: 'reported by' },
  requires: { family: 'dependency', sources: ['claim', 'task', 'research_contract'], targets: ['claim', 'task', 'question'], endpointPairs: ['claim->claim', 'task->task', 'research_contract->question'], forwardLabel: 'required by', reverseLabel: 'requires' },
  derived_from: { family: 'lineage', sources: ANSWER_INPUTS, targets: ['answer', 'claim'], endpointPairs: [...pairs(ANSWER_INPUTS, ['answer']), 'claim->claim'], forwardLabel: 'source for', reverseLabel: 'derived from' },
  extends: { family: 'lineage', sources: ['claim'], targets: ['claim'], forwardLabel: 'extended by', reverseLabel: 'extends' },
  implements: { family: 'lineage', sources: ['claim'], targets: ['claim'], forwardLabel: 'implemented by', reverseLabel: 'implements' },
  supersedes: { family: 'lineage', sources: ANY_RESEARCH_KIND, targets: ANY_RESEARCH_KIND, sameKind: true, forwardLabel: 'superseded by', reverseLabel: 'supersedes' },
};

export const RESEARCH_EDGE_DEFINITIONS = Object.freeze(Object.fromEntries(
  Object.entries(EDGE_DEFINITIONS).map(([type, definition]) => [type, Object.freeze({
    ...definition,
    sources: Object.freeze([...definition.sources]),
    targets: Object.freeze([...definition.targets]),
    endpointPairs: definition.endpointPairs ? Object.freeze([...definition.endpointPairs]) : null,
    sourceRevision: 'exact',
    targetRevision: 'new',
    requiredRoles: Object.freeze([...RESEARCH_AUTHORS]),
  })]),
));
export const RESEARCH_EDGE_TYPES = Object.freeze(Object.keys(RESEARCH_EDGE_DEFINITIONS));
export const RESEARCH_EDGE_FAMILIES = Object.freeze([...new Set(RESEARCH_EDGE_TYPES.map((type) => RESEARCH_EDGE_DEFINITIONS[type].family))]);

export const EVALUATION_STANCES = Object.freeze(['supports', 'refutes', 'qualifies', 'reproduces', 'verifies']);
export const TOOL_KINDS = Object.freeze(['skill', 'method', 'software', 'model', 'workflow']);
export const RESEARCH_DOCUMENT_STATES = Object.freeze(['draft', 'published', 'superseded', 'retracted']);

const NODE_KIND_SET = new Set(RESEARCH_NODE_KINDS);
const EDGE_TYPE_SET = new Set(RESEARCH_EDGE_TYPES);

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function positiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${field} must be a positive safe integer`);
  return value;
}

export function isResearchNodeKind(value) {
  return typeof value === 'string' && NODE_KIND_SET.has(value);
}

export function assertResearchNodeKind(value) {
  if (!isResearchNodeKind(value)) throw new TypeError(`unsupported research node kind: ${String(value)}`);
  return value;
}

export function isResearchEdgeType(value) {
  return typeof value === 'string' && EDGE_TYPE_SET.has(value);
}

export function assertResearchEdgeType(value) {
  if (!isResearchEdgeType(value)) throw new TypeError(`unsupported research edge type: ${String(value)}`);
  return value;
}

export function researchNodeDefinition(kind) {
  return RESEARCH_NODE_DEFINITIONS[assertResearchNodeKind(kind)];
}

export function researchEdgeDefinition(type) {
  return RESEARCH_EDGE_DEFINITIONS[assertResearchEdgeType(type)];
}

export function assertResearchEdgeRole(type, actorRole) {
  const definition = researchEdgeDefinition(type);
  if (typeof actorRole !== 'string' || !definition.requiredRoles.includes(actorRole)) {
    throw new TypeError(`${type} requires one of these project roles: ${definition.requiredRoles.join(', ')}`);
  }
  return actorRole;
}

export function normalizeNodeRevisionRef(value, field = 'node revision ref') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  const kind = assertResearchNodeKind(value.kind);
  const id = requiredText(value.id, `${field} id`);
  const revision = positiveInteger(value.revision, `${field} revision`);
  return Object.freeze({ kind, id, revision });
}

export function normalizeResearchRevisionLineage({ revision = 1, supersedesRevision = null } = {}) {
  revision = positiveInteger(revision, 'research node revision');
  if (revision === 1) {
    if (supersedesRevision !== null && supersedesRevision !== undefined) throw new RangeError('revision 1 must not supersede another revision');
    return Object.freeze({ revision, supersedesRevision: null });
  }
  supersedesRevision = positiveInteger(supersedesRevision, 'supersedes revision');
  if (supersedesRevision !== revision - 1) throw new RangeError('research revisions must supersede the immediately previous revision');
  return Object.freeze({ revision, supersedesRevision });
}

export function compareResearchRanks(left, right) {
  const leftCommit = positiveInteger(left?.commitRank, 'left commit rank');
  const rightCommit = positiveInteger(right?.commitRank, 'right commit rank');
  if (leftCommit !== rightCommit) return leftCommit < rightCommit ? -1 : 1;
  const leftBatch = positiveInteger(left?.batchRank, 'left batch rank');
  const rightBatch = positiveInteger(right?.batchRank, 'right batch rank');
  return leftBatch === rightBatch ? 0 : leftBatch < rightBatch ? -1 : 1;
}

export function assertResearchEdge({ type, source, target, actorRole } = {}) {
  type = assertResearchEdgeType(type);
  source = normalizeNodeRevisionRef(source, 'research edge source');
  target = normalizeNodeRevisionRef(target, 'research edge target');
  if (source.kind === target.kind && source.id === target.id && source.revision === target.revision) {
    throw new RangeError('research edge cannot be a self-loop');
  }
  const definition = researchEdgeDefinition(type);
  const endpointKey = `${source.kind}->${target.kind}`;
  if (!definition.sources.includes(source.kind) || !definition.targets.includes(target.kind)
    || (definition.endpointPairs !== null && !definition.endpointPairs.includes(endpointKey))) {
    throw new TypeError(`${type} does not allow ${source.kind} -> ${target.kind}`);
  }
  if (definition.sameKind && source.kind !== target.kind) throw new TypeError(`${type} requires matching node kinds`);
  if (actorRole !== undefined) assertResearchEdgeRole(type, actorRole);
  return Object.freeze({ type, source, target });
}

export function assertForwardResearchEdge({ type, source, target, sourceRank, targetRank, actorRole } = {}) {
  const edge = assertResearchEdge({ type, source, target, actorRole });
  if (compareResearchRanks(sourceRank, targetRank) >= 0) throw new RangeError('research edge must satisfy sourceRank < targetRank');
  return Object.freeze({ ...edge, sourceRank: Object.freeze({ ...sourceRank }), targetRank: Object.freeze({ ...targetRank }) });
}

function parseDateTime(value, field) {
  requiredText(value, field);
  if (Number.isNaN(Date.parse(value))) throw new TypeError(`${field} must be an ISO-8601 date-time`);
  return value;
}

/** Validate and freeze the public bounded neighborhood wire contract. */
export function validateResearchNeighborhood(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('research neighborhood must be an object');
  if (value.schemaVersion !== 'research-neighborhood.v1') throw new TypeError('unsupported research neighborhood schemaVersion');
  const requestedRoot = normalizeNodeRevisionRef(value.requestedRoot, 'requested root');
  const resolvedRoot = normalizeNodeRevisionRef(value.resolvedRoot, 'resolved root');
  if (!Array.isArray(value.nodes) || value.nodes.length > 200) throw new RangeError('research neighborhood nodes must be an array of at most 200 items');
  if (!Array.isArray(value.edges) || value.edges.length > 400) throw new RangeError('research neighborhood edges must be an array of at most 400 items');
  const nodeKeys = new Set();
  const nodes = value.nodes.map((node, index) => {
    const ref = normalizeNodeRevisionRef(node?.ref, `nodes[${index}].ref`);
    const key = `${ref.kind}:${ref.id}@${ref.revision}`;
    if (nodeKeys.has(key)) throw new TypeError(`duplicate research graph node: ${key}`);
    nodeKeys.add(key);
    const family = requiredText(node.family, `nodes[${index}].family`);
    if (family !== researchNodeDefinition(ref.kind).family) throw new TypeError(`nodes[${index}].family does not match ${ref.kind}`);
    return Object.freeze({
      ref,
      label: requiredText(node.label, `nodes[${index}].label`),
      family,
      state: requiredText(node.state, `nodes[${index}].state`),
      canonicalHref: requiredText(node.canonicalHref, `nodes[${index}].canonicalHref`),
      createdAt: parseDateTime(node.createdAt, `nodes[${index}].createdAt`),
      createdBy: requiredText(node.createdBy, `nodes[${index}].createdBy`),
      isCurrent: Boolean(node.isCurrent),
    });
  });
  const edgeIds = new Set();
  const edges = value.edges.map((edge, index) => {
    const id = requiredText(edge?.id, `edges[${index}].id`);
    if (edgeIds.has(id)) throw new TypeError(`duplicate research graph edge: ${id}`);
    edgeIds.add(id);
    const normalized = assertResearchEdge(edge);
    const sourceKey = `${normalized.source.kind}:${normalized.source.id}@${normalized.source.revision}`;
    const targetKey = `${normalized.target.kind}:${normalized.target.id}@${normalized.target.revision}`;
    if (!nodeKeys.has(sourceKey) || !nodeKeys.has(targetKey)) throw new TypeError(`edges[${index}] references a node outside the neighborhood`);
    const definition = researchEdgeDefinition(normalized.type);
    if (edge.family !== definition.family || edge.forwardLabel !== definition.forwardLabel || edge.reverseLabel !== definition.reverseLabel) {
      throw new TypeError(`edges[${index}] presentation metadata does not match the edge registry`);
    }
    return Object.freeze({
      id,
      ...normalized,
      family: definition.family,
      forwardLabel: definition.forwardLabel,
      reverseLabel: definition.reverseLabel,
      provenanceEventId: requiredText(edge.provenanceEventId, `edges[${index}].provenanceEventId`),
    });
  });
  return Object.freeze({
    schemaVersion: value.schemaVersion,
    requestedRoot,
    resolvedRoot,
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    truncated: Boolean(value.truncated),
    permissionPartial: Boolean(value.permissionPartial),
    nextCursor: value.nextCursor == null ? null : requiredText(value.nextCursor, 'nextCursor'),
    graphWatermark: requiredText(value.graphWatermark, 'graphWatermark'),
  });
}

const DIRECT_LEGACY_RELATIONS = Object.freeze({
  depends_on: 'requires',
  extends: 'extends',
  supersedes: 'supersedes',
  derived_from: 'derived_from',
  uses_method: 'uses_tool',
  uses_dataset: 'uses_dataset',
  implements: 'implements',
});
const EVALUATION_LEGACY_RELATIONS = new Set(['supports', 'qualifies', 'reproduces', 'verifies']);
const REBUTTAL_LEGACY_RELATIONS = new Set(['refutes', 'contradicts', 'challenges']);

function legacyKey(family, value) {
  return `${family}_${semanticHash(value)}`;
}

/** Deterministically translate all 14 legacy Claim relations without mutating legacy rows. */
export function legacyClaimRelationMotif({ relationType, sourceClaimId, targetClaimId, sourceRevision, targetRevision } = {}) {
  relationType = requiredText(relationType, 'legacy claim relation type');
  sourceClaimId = requiredText(sourceClaimId, 'legacy source claim id');
  targetClaimId = requiredText(targetClaimId, 'legacy target claim id');
  const source = normalizeNodeRevisionRef({ kind: 'claim', id: sourceClaimId, revision: sourceRevision });
  const target = normalizeNodeRevisionRef({ kind: 'claim', id: targetClaimId, revision: targetRevision });
  const input = { relationType, source, target };
  if (DIRECT_LEGACY_RELATIONS[relationType]) {
    return Object.freeze({ motif: 'direct', mappingKey: legacyKey('legacy_claim_relation', input), edge: Object.freeze({ type: DIRECT_LEGACY_RELATIONS[relationType], source: target, target: source }) });
  }
  if (EVALUATION_LEGACY_RELATIONS.has(relationType)) {
    return Object.freeze({ motif: 'evaluation', mappingKey: legacyKey('legacy_claim_relation', input), stance: relationType, subject: target, bases: Object.freeze([source]) });
  }
  if (REBUTTAL_LEGACY_RELATIONS.has(relationType)) {
    return Object.freeze({ motif: 'rebuttal', mappingKey: legacyKey('legacy_claim_relation', input), mode: relationType, subject: target, bases: Object.freeze([source]) });
  }
  throw new TypeError(`unsupported legacy claim relation type: ${relationType}`);
}

/** Translate the four legacy Evidence -> ClaimRevision links into Evaluation motifs. */
export function legacyEvidenceClaimMotif({ relationType, evidenceId, claimId, claimRevision } = {}) {
  relationType = requiredText(relationType, 'legacy evidence relation type');
  if (!['supports', 'refutes', 'qualifies', 'reproduces'].includes(relationType)) throw new TypeError(`unsupported legacy evidence relation type: ${relationType}`);
  const basis = normalizeNodeRevisionRef({ kind: 'evidence', id: requiredText(evidenceId, 'legacy evidence id'), revision: 1 });
  const subject = normalizeNodeRevisionRef({ kind: 'claim', id: requiredText(claimId, 'legacy claim id'), revision: claimRevision });
  const input = { relationType, basis, subject };
  return Object.freeze({ motif: 'evaluation', mappingKey: legacyKey('legacy_evidence_claim_link', input), stance: relationType, subject, bases: Object.freeze([basis]) });
}

export function legacyChallengeRevisionMotif({ challengeId, challengeRevision, targetClaimId, targetClaimRevision } = {}) {
  const source = normalizeNodeRevisionRef({ kind: 'claim', id: requiredText(targetClaimId, 'legacy Challenge target Claim id'), revision: targetClaimRevision });
  const target = normalizeNodeRevisionRef({ kind: 'challenge', id: requiredText(challengeId, 'legacy Challenge id'), revision: challengeRevision });
  const input = { source, target };
  return Object.freeze({
    motif: 'direct', mappingKey: legacyKey('legacy_challenge_revision', input),
    edge: Object.freeze({ type: 'challenges', source, target }), registerTarget: target,
  });
}

export function legacyChallengeImpactMotif({ impactId, challengeId, challengeRevision, claimId, claimRevision, impactType } = {}) {
  const source = normalizeNodeRevisionRef({ kind: 'claim', id: requiredText(claimId, 'legacy Challenge impact Claim id'), revision: claimRevision });
  const target = normalizeNodeRevisionRef({ kind: 'challenge', id: requiredText(challengeId, 'legacy Challenge impact id'), revision: challengeRevision });
  const input = { impactId: requiredText(impactId, 'legacy Challenge impact record id'), impactType: requiredText(impactType, 'legacy Challenge impact type'), source, target };
  return Object.freeze({ motif: 'direct', mappingKey: legacyKey('legacy_challenge_impact', input), edge: Object.freeze({ type: 'challenges', source, target }) });
}

export function legacyTaskDependencyMotif({ sourceTaskId, sourceTaskRevision, targetTaskId, targetTaskRevision } = {}) {
  const dependent = normalizeNodeRevisionRef({ kind: 'task', id: requiredText(sourceTaskId, 'legacy dependent Task id'), revision: sourceTaskRevision });
  const prerequisite = normalizeNodeRevisionRef({ kind: 'task', id: requiredText(targetTaskId, 'legacy prerequisite Task id'), revision: targetTaskRevision });
  const input = { dependent, prerequisite };
  return Object.freeze({ motif: 'direct', mappingKey: legacyKey('legacy_task_dependency', input), edge: Object.freeze({ type: 'requires', source: prerequisite, target: dependent }) });
}

export function legacyRunInputMotif({ runId, runRevision = 1, artifactId, artifactRevision } = {}) {
  const source = normalizeNodeRevisionRef({ kind: 'artifact', id: requiredText(artifactId, 'legacy Run input Artifact id'), revision: artifactRevision });
  const target = normalizeNodeRevisionRef({ kind: 'run', id: requiredText(runId, 'legacy Run input Run id'), revision: runRevision });
  const input = { source, target };
  return Object.freeze({ motif: 'direct', mappingKey: legacyKey('legacy_run_input', input), edge: Object.freeze({ type: 'run_input', source, target }) });
}

export function legacyRunOutputMotif({ runId, runRevision = 1, artifactId, artifactRevision } = {}) {
  const source = normalizeNodeRevisionRef({ kind: 'run', id: requiredText(runId, 'legacy Run output Run id'), revision: runRevision });
  const target = normalizeNodeRevisionRef({ kind: 'artifact', id: requiredText(artifactId, 'legacy Run output Artifact id'), revision: artifactRevision });
  const input = { source, target };
  return Object.freeze({ motif: 'direct', mappingKey: legacyKey('legacy_run_output', input), edge: Object.freeze({ type: 'produces_artifact', source, target }) });
}
