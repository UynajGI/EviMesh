import { createUuidV7, isUuidV7 } from './uuidv7.mjs';

const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/i;

function requireEventType(value) {
  if (typeof value !== 'string' || !EVENT_TYPE_PATTERN.test(value)) {
    throw new TypeError('event type must be a namespaced string');
  }
}

function requireHash(value) {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    throw new TypeError('event hash must be a sha256 digest');
  }
}

function freezeValue(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }

  const entries = Object.entries(value).map(([key, entry]) => {
    if (entry === undefined) {
      throw new TypeError(`${field}.${key} must have a value`);
    }
    const frozen = entry && typeof entry === 'object' && !Array.isArray(entry)
      ? freezeValue(entry, `${field}.${key}`)
      : Array.isArray(entry) ? Object.freeze([...entry]) : entry;
    return [key, frozen];
  });

  return Object.freeze(Object.fromEntries(entries));
}

function freezeParents(value) {
  if (!Array.isArray(value) || value.some((parent) => !isUuidV7(parent))) {
    throw new TypeError('event parents must be an array of UUIDv7 event IDs');
  }
  return Object.freeze([...value]);
}

export function createResearchEvent({
  eventId = createUuidV7(),
  eventType,
  payload,
  hash,
  signature,
  parents = [],
} = {}) {
  if (!isUuidV7(eventId)) {
    throw new TypeError('event ID must be a UUIDv7');
  }
  requireEventType(eventType);
  const frozenPayload = freezeValue(payload, 'event payload');
  requireHash(hash);
  const frozenSignature = freezeValue(signature, 'event signature');

  return Object.freeze({
    schema: 'srp.event.v1',
    event_id: eventId,
    event_type: eventType,
    payload: frozenPayload,
    hash,
    signature: frozenSignature,
    parents: freezeParents(parents),
  });
}
