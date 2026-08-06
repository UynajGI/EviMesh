export class ProvExportError extends Error {
  constructor(message, code = 'PROV_EXPORT_INVALID') {
    super(message);
    this.name = 'ProvExportError';
    this.code = code;
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new ProvExportError(`${field} must be a non-empty string`);
  return value.trim();
}

function entityId(edge) {
  return `entity:${edge.objectType}:${edge.objectId}:${edge.objectRevision}`;
}

/** Map contribution statements and typed revision edges to a compact W3C PROV-JSON document. */
export function exportContributionProv({ statements, edges } = {}) {
  if (!Array.isArray(statements) || !Array.isArray(edges)) throw new ProvExportError('statements and edges must be arrays');
  const activities = {};
  const agents = {};
  const associations = {};
  const statementIds = new Set();
  for (const statement of statements) {
    if (!statement || typeof statement !== 'object') throw new ProvExportError('contribution statement must be an object');
    const statementId = requiredText(statement.statementId, 'statement id');
    if (statementIds.has(statementId)) throw new ProvExportError('statement ids must be unique');
    statementIds.add(statementId);
    const actorId = requiredText(statement.actorId, 'actor id');
    const role = requiredText(statement.role, 'role');
    const description = requiredText(statement.description, 'description');
    const activityId = `activity:${statementId}`;
    const agentId = `agent:${actorId}`;
    activities[activityId] = { 'prov:type': 'evimesh:ContributionStatement', 'prov:label': description };
    agents[agentId] ??= { 'prov:type': 'prov:Agent' };
    associations[`association:${statementId}`] = { 'prov:activity': activityId, 'prov:agent': agentId, 'prov:hadRole': role };
  }
  const entities = {};
  const used = {};
  const generated = {};
  for (const edge of edges) {
    if (!edge || typeof edge !== 'object' || !statementIds.has(edge.statementId)) throw new ProvExportError('edge must reference a known contribution statement');
    if (!['used', 'produced'].includes(edge.edgeType)) throw new ProvExportError('edge type must be used or produced');
    const objectType = requiredText(edge.objectType, 'object type');
    const objectId = requiredText(edge.objectId, 'object id');
    if (!Number.isInteger(edge.objectRevision) || edge.objectRevision < 1) throw new ProvExportError('object revision must be a positive integer');
    const id = entityId({ objectType, objectId, objectRevision: edge.objectRevision });
    entities[id] ??= { 'prov:type': `evimesh:${objectType}`, 'evimesh:objectId': objectId, 'evimesh:revision': edge.objectRevision };
    const activityId = `activity:${edge.statementId}`;
    if (edge.edgeType === 'used') used[`used:${edge.statementId}:${id}`] = { 'prov:activity': activityId, 'prov:entity': id };
    else generated[`generated:${edge.statementId}:${id}`] = { 'prov:entity': id, 'prov:activity': activityId };
  }
  return Object.freeze({
    '@context': 'https://www.w3.org/ns/prov.jsonld',
    entity: entities,
    activity: activities,
    agent: agents,
    wasAssociatedWith: associations,
    used,
    wasGeneratedBy: generated,
  });
}
