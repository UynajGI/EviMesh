import { paginate } from './pagination.mjs';

export class ResearchEventQueryError extends Error {
  constructor(message, code = 'RESEARCH_EVENT_QUERY_INVALID', status = 400) {
    super(message);
    this.name = 'ResearchEventQueryError';
    this.code = code;
    this.status = status;
  }
}

function optionalText(value, field) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ResearchEventQueryError(`${field} must be a non-empty string, null, or undefined`);
  }
  return value.trim();
}

function optionalTimestamp(value, field) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new ResearchEventQueryError(`${field} must be an ISO-8601 timestamp, null, or undefined`);
  }
  return new Date(value).toISOString();
}

function paginationOptions({ limit, cursor }) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ResearchEventQueryError('limit must be an integer between 1 and 100');
  }
  if (cursor !== null && cursor !== undefined && (typeof cursor !== 'string' || cursor.length === 0)) {
    throw new ResearchEventQueryError('cursor must be a non-empty string or null');
  }
  return { limit, cursor: cursor ?? null };
}

/** List formal Events by object, Actor, type, and created-time range. */
export async function listResearchEvents({
  repository,
  objectType = null,
  objectId = null,
  actorId = null,
  eventType = null,
  createdAfter = null,
  createdBefore = null,
  limit = 20,
  cursor = null,
} = {}) {
  if (!repository || typeof repository.listResearchEvents !== 'function') {
    throw new ResearchEventQueryError('repository listResearchEvents is required');
  }
  const filters = {
    objectType: optionalText(objectType, 'object type'),
    objectId: optionalText(objectId, 'object id'),
    actorId: optionalText(actorId, 'actor id'),
    eventType: optionalText(eventType, 'event type'),
    createdAfter: optionalTimestamp(createdAfter, 'created after'),
    createdBefore: optionalTimestamp(createdBefore, 'created before'),
  };
  if ((filters.objectType === null) !== (filters.objectId === null)) {
    throw new ResearchEventQueryError('object type and object id must be provided together');
  }
  if (filters.createdAfter !== null && filters.createdBefore !== null && filters.createdAfter > filters.createdBefore) {
    throw new ResearchEventQueryError('created after must not be later than created before');
  }
  const events = await repository.listResearchEvents(filters);
  return paginate(Array.isArray(events) ? events : [], {
    ...paginationOptions({ limit, cursor }),
    getKey: (event) => ({ createdAt: event.createdAt, id: event.eventId }),
  });
}
