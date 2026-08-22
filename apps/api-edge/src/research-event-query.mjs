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

function safeIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || Number.isNaN(Date.parse(value))) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1
    && month <= 12
    && day >= 1
    && day <= daysInMonth[month - 1]
    && Number(hourText) <= 23
    && Number(minuteText) <= 59
    && Number(secondText) <= 59;
}

function decodePaginationCursor(cursor) {
  if (cursor === null) return null;
  try {
    const padded = cursor.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(cursor.length / 4) * 4, '=');
    const decoded = JSON.parse(atob(padded));
    const plainObject = decoded !== null
      && typeof decoded === 'object'
      && !Array.isArray(decoded)
      && Object.getPrototypeOf(decoded) === Object.prototype;
    const validCreatedAt = plainObject && safeIsoTimestamp(decoded.createdAt);
    const validId = plainObject
      && typeof decoded.id === 'string'
      && /^[A-Za-z0-9_-]+$/.test(decoded.id);
    if (!validCreatedAt || !validId) throw new TypeError('invalid pagination cursor');
    return { createdAt: decoded.createdAt, id: decoded.id };
  } catch {
    throw new TypeError('invalid pagination cursor');
  }
}

function eventOrder(value) {
  if (value === null || value === undefined) return 'asc';
  if (value !== 'asc' && value !== 'desc') throw new ResearchEventQueryError('order must be asc or desc');
  return value;
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
  order = 'asc',
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
    order: eventOrder(order),
  };
  if ((filters.objectType === null) !== (filters.objectId === null)) {
    throw new ResearchEventQueryError('object type and object id must be provided together');
  }
  if (filters.createdAfter !== null && filters.createdBefore !== null && filters.createdAfter > filters.createdBefore) {
    throw new ResearchEventQueryError('created after must not be later than created before');
  }
  const pagination = paginationOptions({ limit, cursor });
  const actorOnly = filters.actorId !== null
    && filters.objectType === null
    && filters.objectId === null
    && filters.eventType === null
    && filters.createdAfter === null
    && filters.createdBefore === null;
  const events = await repository.listResearchEvents({
    ...filters,
    ...(actorOnly ? {
      page: {
        after: decodePaginationCursor(pagination.cursor),
        limit: pagination.limit + 1,
      },
    } : {}),
  });
  return paginate(Array.isArray(events) ? events : [], {
    ...pagination,
    direction: filters.order,
    getKey: (event) => ({ createdAt: event.createdAt, id: event.eventId }),
  });
}
