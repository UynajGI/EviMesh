import { paginate } from './pagination.mjs';

export class EvidenceQueryError extends Error {
  constructor(message, code = 'EVIDENCE_QUERY_INVALID', status = 400) {
    super(message);
    this.name = 'EvidenceQueryError';
    this.code = code;
    this.status = status;
  }
}

function optionalFilter(value, field) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.trim().length === 0) throw new EvidenceQueryError(`${field} must be a non-empty string, null, or undefined`);
  return value.trim();
}

function requiredId(value) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new EvidenceQueryError('evidence id must be a non-empty string');
  return value.trim();
}

function requireRepository(repository, methods, message) {
  if (!repository || methods.some((method) => typeof repository[method] !== 'function')) throw new EvidenceQueryError(message);
}

export async function listEvidence({ repository, evidenceType = null, claimId = null, limit = 20, cursor = null } = {}) {
  requireRepository(repository, ['listEvidence'], 'repository listEvidence is required');
  const evidence = await repository.listEvidence({ evidenceType: optionalFilter(evidenceType, 'evidence type'), claimId: optionalFilter(claimId, 'claim id') });
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new EvidenceQueryError('limit must be an integer between 1 and 100');
  if (cursor !== null && cursor !== undefined && (typeof cursor !== 'string' || cursor.length === 0)) throw new EvidenceQueryError('cursor must be a non-empty string or null');
  return paginate(evidence, { limit, cursor: cursor ?? null, getKey: (item) => ({ createdAt: item.createdAt, id: item.evidenceId }) });
}

export async function getEvidence({ repository, evidenceId } = {}) {
  evidenceId = requiredId(evidenceId);
  requireRepository(repository, ['getEvidence', 'listEvidenceClaimLinks'], 'repository evidence detail methods are required');
  const evidence = await repository.getEvidence(evidenceId);
  if (!evidence) throw new EvidenceQueryError('evidence not found', 'EVIDENCE_NOT_FOUND', 404);
  const links = await repository.listEvidenceClaimLinks(evidenceId);
  return { evidence, claimLinks: Array.isArray(links) ? links : [] };
}
