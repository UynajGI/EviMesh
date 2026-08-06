import { signEd25519Payload } from './client-signature.mjs';
import { verifyEd25519Payload } from './server-verification.mjs';

const ROOT_HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function normalizeCheckpoint(checkpoint) {
  if (!checkpoint || typeof checkpoint !== 'object' || Array.isArray(checkpoint)) throw new TypeError('checkpoint must be an object');
  if (checkpoint.schema !== 'evimesh.merkle-checkpoint.v1') throw new TypeError('checkpoint schema must be evimesh.merkle-checkpoint.v1');
  const firstEventId = requiredText(checkpoint.firstEventId, 'first event id');
  const lastEventId = requiredText(checkpoint.lastEventId, 'last event id');
  if (!Number.isInteger(checkpoint.eventCount) || checkpoint.eventCount < 1) throw new TypeError('checkpoint event count must be a positive integer');
  if (typeof checkpoint.rootHash !== 'string' || !ROOT_HASH_PATTERN.test(checkpoint.rootHash)) throw new TypeError('checkpoint root hash must be a sha256 digest');
  return { schema: checkpoint.schema, firstEventId, lastEventId, eventCount: checkpoint.eventCount, rootHash: checkpoint.rootHash };
}

function signingBytes(checkpoint) {
  return new TextEncoder().encode(JSON.stringify({
    schema: checkpoint.schema,
    first_event_id: checkpoint.firstEventId,
    last_event_id: checkpoint.lastEventId,
    event_count: checkpoint.eventCount,
    root_hash: checkpoint.rootHash,
  }));
}

/** Sign a complete Merkle checkpoint so its root cannot be detached from its Event range. */
export async function signMerkleCheckpoint({ checkpoint, keyId, privateKey } = {}) {
  const normalized = normalizeCheckpoint(checkpoint);
  keyId = requiredText(keyId, 'platform key id');
  const value = await signEd25519Payload({ signingBytes: signingBytes(normalized), privateKey });
  return Object.freeze({
    ...normalized,
    signature: Object.freeze({ algorithm: 'Ed25519', keyId, value }),
  });
}

/** Verify a signed complete Merkle checkpoint against a published platform Ed25519 public key. */
export async function verifyMerkleCheckpoint({ checkpoint, publicKey } = {}) {
  try {
    const normalized = normalizeCheckpoint(checkpoint);
    const signature = checkpoint.signature;
    if (!signature || typeof signature !== 'object' || Array.isArray(signature) || signature.algorithm !== 'Ed25519') return false;
    requiredText(signature.keyId, 'platform key id');
    return verifyEd25519Payload({ signingBytes: signingBytes(normalized), signature: signature.value, publicKey });
  } catch {
    return false;
  }
}
