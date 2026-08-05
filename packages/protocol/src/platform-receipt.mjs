import { isUuidV7 } from './uuidv7.mjs';

function freezeObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return Object.freeze({ ...value });
}

function assertTimestamp(value) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new TypeError('server time must be an ISO-8601 timestamp');
  }
}

export function createPlatformReceipt({ eventId, serverTime, serverSignature } = {}) {
  if (!isUuidV7(eventId)) {
    throw new TypeError('receipt event ID must be a UUIDv7');
  }
  assertTimestamp(serverTime);
  const frozenSignature = freezeObject(serverSignature, 'server signature');

  return Object.freeze({
    schema: 'srp.platform-receipt.v1',
    server_time: serverTime,
    event_id: eventId,
    server_signature: frozenSignature,
  });
}
