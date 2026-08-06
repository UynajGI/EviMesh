export class ContributionEdgeError extends Error {
  constructor(message, code = 'CONTRIBUTION_EDGE_INVALID', status = 400) {
    super(message);
    this.name = 'ContributionEdgeError';
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new ContributionEdgeError(`${field} must be a non-empty string`);
  return value.trim();
}

function normalizeReference({ statementId, objectType, objectId, objectRevision }) {
  if (!Number.isInteger(objectRevision) || objectRevision < 1) {
    throw new ContributionEdgeError('object revision must be a positive integer');
  }
  return {
    statementId: requiredText(statementId, 'contribution statement id'),
    objectType: requiredText(objectType, 'object type'),
    objectId: requiredText(objectId, 'object id'),
    objectRevision,
  };
}

/** Attach a contribution statement to one existing output object revision. */
export async function addContributionProducedEdge({ repository, statementId, objectType, objectId, objectRevision } = {}) {
  if (!repository || typeof repository.withTransaction !== 'function') {
    throw new ContributionEdgeError('repository withTransaction is required');
  }
  for (const method of ['getContributionStatement', 'getObjectRevision', 'insertContributionEdge']) {
    if (typeof repository[method] !== 'function') throw new ContributionEdgeError(`repository ${method} is required`);
  }
  const reference = normalizeReference({ statementId, objectType, objectId, objectRevision });
  return repository.withTransaction(async (transaction) => {
    if (!await transaction.getContributionStatement(reference.statementId)) {
      throw new ContributionEdgeError('contribution statement not found', 'CONTRIBUTION_STATEMENT_NOT_FOUND', 404);
    }
    if (!await transaction.getObjectRevision({ objectType: reference.objectType, objectId: reference.objectId, revision: reference.objectRevision })) {
      throw new ContributionEdgeError('output object revision not found', 'CONTRIBUTION_OUTPUT_NOT_FOUND', 404);
    }
    const edge = { ...reference, edgeType: 'produced' };
    return await transaction.insertContributionEdge(edge) ?? edge;
  });
}
