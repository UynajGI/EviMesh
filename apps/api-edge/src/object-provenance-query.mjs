export class ObjectProvenanceQueryError extends Error {
  constructor(message, code = 'OBJECT_PROVENANCE_QUERY_INVALID', status = 400) {
    super(message);
    this.name = 'ObjectProvenanceQueryError';
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new ObjectProvenanceQueryError(`${field} must be a non-empty string`);
  return value.trim();
}

function reference({ objectType, objectId, objectRevision }) {
  if (!Number.isInteger(objectRevision) || objectRevision < 1) throw new ObjectProvenanceQueryError('object revision must be a positive integer');
  return { objectType: requiredText(objectType, 'object type'), objectId: requiredText(objectId, 'object id'), objectRevision };
}

/** Return the Actor -> Event -> Object -> Frontier provenance path for one immutable object revision. */
export async function getObjectProvenance({ repository, objectType, objectId, objectRevision } = {}) {
  const methods = ['getObjectRevision', 'listContributionEdgesForObject', 'listContributionStatementsByIds', 'listResearchEventsForObject', 'listFrontiersForObjectRevision'];
  if (!repository || methods.some((method) => typeof repository[method] !== 'function')) {
    throw new ObjectProvenanceQueryError('repository object provenance methods are required');
  }
  const object = reference({ objectType, objectId, objectRevision });
  const revision = await repository.getObjectRevision({ objectType: object.objectType, objectId: object.objectId, revision: object.objectRevision });
  if (!revision) throw new ObjectProvenanceQueryError('object revision not found', 'OBJECT_PROVENANCE_OBJECT_NOT_FOUND', 404);
  const edges = await repository.listContributionEdgesForObject(object);
  const statementIds = [...new Set((Array.isArray(edges) ? edges : []).map((edge) => edge?.statementId).filter(Boolean))];
  const actors = await repository.listContributionStatementsByIds(statementIds);
  const events = await repository.listResearchEventsForObject({ objectType: object.objectType, objectId: object.objectId });
  const frontier = await repository.listFrontiersForObjectRevision(object);
  if (!Array.isArray(actors) || actors.length === 0 || !Array.isArray(events) || events.length === 0 || !Array.isArray(frontier) || frontier.length === 0) {
    throw new ObjectProvenanceQueryError('complete provenance path not found', 'OBJECT_PROVENANCE_PATH_NOT_FOUND', 404);
  }
  return Object.freeze({
    actors,
    events,
    object: { ...object, revision },
    frontier,
  });
}
