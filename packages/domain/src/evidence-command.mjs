import { assertProjectRoleForAction } from './project-authorization.mjs';

const EVIDENCE_TYPES = new Set(['formal_proof', 'numerical_result', 'experimental_result', 'dataset', 'literature_support', 'counterexample', 'benchmark', 'statistical_analysis', 'code_test', 'negative_result', 'expert_assessment']);
const LINK_TYPES = new Set(['supports', 'refutes', 'qualifies', 'reproduces']);

export class EvidenceCommandError extends Error {
  constructor(message, code = 'EVIDENCE_INVALID', status = 400) {
    super(message);
    this.name = 'EvidenceCommandError';
    this.code = code;
    this.status = status;
  }
}
function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new EvidenceCommandError(`${field} must be a non-empty string`);
  return value.trim();
}

function positiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) throw new EvidenceCommandError(`${field} must be a positive integer`);
  return value;
}

/** Create immutable Evidence and optional ClaimRevision links atomically. */
export async function createEvidence({ repository, actorId, actorRole, evidenceId, evidenceType, artifactId, artifactRevision, runId = null, links = [], eventFactory } = {}) {
  if (!repository || typeof repository.withTransaction !== 'function') throw new EvidenceCommandError('repository withTransaction is required');
  for (const method of ['insertEvidence', 'insertEvidenceClaimLink', 'appendResearchEvent']) {
    if (typeof repository[method] !== 'function') throw new EvidenceCommandError(`repository ${method} is required`);
  }
  actorId = requiredText(actorId, 'actor id');
  evidenceId = requiredText(evidenceId, 'evidence id');
  evidenceType = requiredText(evidenceType, 'evidence type');
  if (!EVIDENCE_TYPES.has(evidenceType)) throw new EvidenceCommandError(`unsupported evidence type: ${evidenceType}`);
  artifactId = requiredText(artifactId, 'artifact id');
  artifactRevision = positiveInteger(artifactRevision, 'artifact revision');
  if (runId !== null) runId = requiredText(runId, 'run id');
  if (!Array.isArray(links)) throw new EvidenceCommandError('links must be an array');
  const normalizedLinks = links.map((link) => {
    const relationType = requiredText(link?.relationType, 'link relation type');
    if (!LINK_TYPES.has(relationType)) throw new EvidenceCommandError(`unsupported evidence link relation: ${relationType}`);
    return { evidenceId, claimId: requiredText(link.claimId, 'claim id'), claimRevision: positiveInteger(link.claimRevision, 'claim revision'), relationType, createdBy: actorId };
  });
  if (typeof eventFactory !== 'function') throw new EvidenceCommandError('eventFactory is required');
  assertProjectRoleForAction({ actorRole, requiredRole: 'contributor' });
  const evidence = { evidenceId, evidenceType, artifactId, artifactRevision, runId, createdBy: actorId };
  const event = await eventFactory({ eventType: 'evidence.created', payload: { entity_type: 'evidence', evidence_id: evidenceId, actor_id: actorId, link_count: normalizedLinks.length } });
  if (!event || typeof event !== 'object') throw new EvidenceCommandError('eventFactory must return an event object');
  return repository.withTransaction(async (transaction) => ({
    evidence: await transaction.insertEvidence(evidence) ?? evidence,
    links: await Promise.all(normalizedLinks.map((link) => transaction.insertEvidenceClaimLink(link))),
    event: await transaction.appendResearchEvent(event) ?? event,
  }));
}
