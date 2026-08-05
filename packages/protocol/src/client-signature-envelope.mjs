import { canonicalJson, rawHash } from './hash.mjs';

const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

function freezeObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return Object.freeze({ ...value });
}

function assertEventType(value) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/.test(value)) {
    throw new TypeError('event type must be a namespaced string');
  }
}

function assertNonce(value) {
  if (typeof value !== 'string' || !NONCE_PATTERN.test(value)) {
    throw new TypeError('nonce must be 16-128 base64url characters');
  }
}

export function createClientSignatureEnvelope({ eventType, payload, nonce, signature } = {}) {
  assertEventType(eventType);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('signature payload must be an object');
  }
  assertNonce(nonce);
  const signingObject = { event_type: eventType, payload, nonce };
  const signingBytes = canonicalJson(signingObject);

  return Object.freeze({
    schema: 'srp.client-signature-envelope.v1',
    event_type: eventType,
    payload: freezeObject(payload, 'signature payload'),
    nonce,
    signing_bytes: signingBytes,
    signing_bytes_hash: `sha256:${rawHash(signingBytes)}`,
    signature: freezeObject(signature, 'signature'),
  });
}
