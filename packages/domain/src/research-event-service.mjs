import { createResearchEvent } from '../../protocol/src/research-event.mjs';

export class ResearchEventAppendError extends Error {
  constructor(message, code = 'RESEARCH_EVENT_INVALID', status = 400) {
    super(message);
    this.name = 'ResearchEventAppendError';
    this.code = code;
    this.status = status;
  }
}

function normalizeEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new ResearchEventAppendError('research event must be an object');
  }
  try {
    return createResearchEvent({
      eventId: event.event_id,
      eventType: event.event_type,
      payload: event.payload,
      hash: event.hash,
      signature: event.signature,
      parents: event.parents,
    });
  } catch (error) {
    throw new ResearchEventAppendError(error.message);
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ResearchEventAppendError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function assertObjectChain(event, { objectType, objectId, previousEventHash }) {
  const integrity = event.payload?.integrity;
  if (!integrity || typeof integrity !== 'object' || Array.isArray(integrity)) {
    throw new ResearchEventAppendError('event payload integrity is required');
  }
  if (integrity.object_type !== objectType || integrity.object_id !== objectId) {
    throw new ResearchEventAppendError('event payload integrity object does not match the requested object');
  }
  if ((integrity.previous_event_hash ?? null) !== previousEventHash) {
    throw new ResearchEventAppendError('event payload integrity previous hash does not match the object chain head', 'OBJECT_EVENT_HASH_CHAIN_CONFLICT', 409);
  }
}

function assertActorChain(event, { actorId, previousEventHash }) {
  const integrity = event.payload?.integrity;
  if (!integrity || typeof integrity !== 'object' || Array.isArray(integrity)) {
    throw new ResearchEventAppendError('event payload integrity is required');
  }
  if (integrity.actor_id !== actorId) {
    throw new ResearchEventAppendError('event payload integrity actor does not match the requested actor');
  }
  if ((integrity.previous_actor_event_hash ?? null) !== previousEventHash) {
    throw new ResearchEventAppendError('event payload integrity previous hash does not match the actor chain head', 'ACTOR_EVENT_HASH_CHAIN_CONFLICT', 409);
  }
}

async function appendNormalizedResearchEvent(transaction, normalized) {
  if (await transaction.getResearchEvent(normalized.event_id)) {
    throw new ResearchEventAppendError('research event already exists', 'RESEARCH_EVENT_EXISTS', 409);
  }
  for (const parentEventId of normalized.parents) {
    if (!await transaction.getResearchEvent(parentEventId)) {
      throw new ResearchEventAppendError('parent research event not found', 'RESEARCH_EVENT_PARENT_NOT_FOUND', 404);
    }
  }
  const record = {
    eventId: normalized.event_id,
    eventType: normalized.event_type,
    payload: normalized.payload,
    hash: normalized.hash,
    signature: normalized.signature,
    parents: normalized.parents,
  };
  const persistedEvent = await transaction.insertResearchEvent(record);
  const parents = await Promise.all(normalized.parents.map((parentEventId) => transaction.insertResearchEventParent({
    eventId: normalized.event_id,
    parentEventId,
  })));
  return { event: persistedEvent ?? record, parents };
}

/** Append a signed SRP Event and its immutable parent links in one transaction. */
export async function appendResearchEvent({ repository, event } = {}) {
  if (!repository || typeof repository.withTransaction !== 'function') {
    throw new ResearchEventAppendError('repository withTransaction is required');
  }
  for (const method of ['getResearchEvent', 'insertResearchEvent', 'insertResearchEventParent']) {
    if (typeof repository[method] !== 'function') {
      throw new ResearchEventAppendError(`repository ${method} is required`);
    }
  }
  const normalized = normalizeEvent(event);
  if (new Set(normalized.parents).size !== normalized.parents.length) {
    throw new ResearchEventAppendError('event parents must be unique');
  }

  return repository.withTransaction(async (transaction) => {
    return appendNormalizedResearchEvent(transaction, normalized);
  });
}

/** Append a signed Event whose payload binds it to the prior Event hash for one object. */
export async function appendObjectResearchEvent({ repository, objectType, objectId, eventFactory } = {}) {
  if (!repository || typeof repository.withTransaction !== 'function') {
    throw new ResearchEventAppendError('repository withTransaction is required');
  }
  for (const method of ['getLatestObjectEventHash', 'getResearchEvent', 'insertResearchEvent', 'insertResearchEventParent']) {
    if (typeof repository[method] !== 'function') {
      throw new ResearchEventAppendError(`repository ${method} is required`);
    }
  }
  objectType = requiredText(objectType, 'object type');
  objectId = requiredText(objectId, 'object id');
  if (typeof eventFactory !== 'function') throw new ResearchEventAppendError('eventFactory is required');

  return repository.withTransaction(async (transaction) => {
    const previousEventHash = await transaction.getLatestObjectEventHash({ objectType, objectId }) ?? null;
    if (previousEventHash !== null && (typeof previousEventHash !== 'string' || !/^sha256:[0-9a-f]{64}$/i.test(previousEventHash))) {
      throw new ResearchEventAppendError('object event chain head must be a sha256 digest');
    }
    const event = normalizeEvent(await eventFactory({ objectType, objectId, previousEventHash }));
    if (new Set(event.parents).size !== event.parents.length) {
      throw new ResearchEventAppendError('event parents must be unique');
    }
    assertObjectChain(event, { objectType, objectId, previousEventHash });
    return appendNormalizedResearchEvent(transaction, event);
  });
}

/** Append a signed Event whose payload binds it to the prior Event hash for one Actor. */
export async function appendActorResearchEvent({ repository, actorId, eventFactory } = {}) {
  if (!repository || typeof repository.withTransaction !== 'function') {
    throw new ResearchEventAppendError('repository withTransaction is required');
  }
  for (const method of ['getLatestActorEventHash', 'getResearchEvent', 'insertResearchEvent', 'insertResearchEventParent']) {
    if (typeof repository[method] !== 'function') {
      throw new ResearchEventAppendError(`repository ${method} is required`);
    }
  }
  actorId = requiredText(actorId, 'actor id');
  if (typeof eventFactory !== 'function') throw new ResearchEventAppendError('eventFactory is required');

  return repository.withTransaction(async (transaction) => {
    const previousEventHash = await transaction.getLatestActorEventHash(actorId) ?? null;
    if (previousEventHash !== null && (typeof previousEventHash !== 'string' || !/^sha256:[0-9a-f]{64}$/i.test(previousEventHash))) {
      throw new ResearchEventAppendError('actor event chain head must be a sha256 digest');
    }
    const event = normalizeEvent(await eventFactory({ actorId, previousEventHash }));
    if (new Set(event.parents).size !== event.parents.length) {
      throw new ResearchEventAppendError('event parents must be unique');
    }
    assertActorChain(event, { actorId, previousEventHash });
    return appendNormalizedResearchEvent(transaction, event);
  });
}

/** Return the original signature stored with one formal ResearchEvent without re-encoding it. */
export async function getResearchEventSignature({ repository, eventId } = {}) {
  if (!repository || typeof repository.getResearchEvent !== 'function') {
    throw new ResearchEventAppendError('repository getResearchEvent is required');
  }
  eventId = requiredText(eventId, 'event id');
  const event = await repository.getResearchEvent(eventId);
  if (!event) throw new ResearchEventAppendError('research event not found', 'RESEARCH_EVENT_NOT_FOUND', 404);
  if (!event.signature || typeof event.signature !== 'object' || Array.isArray(event.signature)) {
    throw new ResearchEventAppendError('stored research event signature is invalid', 'RESEARCH_EVENT_SIGNATURE_INVALID', 500);
  }
  return event.signature;
}
