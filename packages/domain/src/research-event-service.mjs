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
  });
}
