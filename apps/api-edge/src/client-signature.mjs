import { canonicalJson, rawHash } from '../../../packages/protocol/src/hash.mjs';
import { verifyEd25519Payload } from '../../../packages/signatures/src/server-verification.mjs';

const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export class ClientSignatureError extends Error {
  constructor(message, code = 'CLIENT_SIGNATURE_INVALID', status = 400) {
    super(message);
    this.name = 'ClientSignatureError';
    this.code = code;
    this.status = status;
  }
}

function canonicalOrThrow(value, field) {
  try {
    return canonicalJson(value);
  } catch (error) {
    throw new ClientSignatureError(`signature envelope ${field} is not JSON-compatible`);
  }
}

/**
 * Verify one client signature envelope against the exact request payload.
 * Fail-closed: any structural, key, payload, or cryptographic mismatch rejects
 * the submission.
 */
export async function verifyClientSignatureEnvelope({ repository, actorId, envelope, payload, expectedEventType } = {}) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new ClientSignatureError('signature envelope is required');
  }
  if (envelope.schema !== 'srp.client-signature-envelope.v1') {
    throw new ClientSignatureError('unsupported signature envelope schema');
  }
  if (typeof envelope.event_type !== 'string' || envelope.event_type.length === 0) {
    throw new ClientSignatureError('signature envelope event type is required');
  }
  if (typeof expectedEventType === 'string' && envelope.event_type !== expectedEventType) {
    throw new ClientSignatureError('signature envelope event type does not match this endpoint', 'CLIENT_SIGNATURE_EVENT_TYPE_MISMATCH');
  }
  if (typeof envelope.nonce !== 'string' || !NONCE_PATTERN.test(envelope.nonce)) {
    throw new ClientSignatureError('signature envelope nonce must be 16-128 base64url characters');
  }
  const signature = envelope.signature;
  if (!signature || typeof signature !== 'object' || Array.isArray(signature)
    || signature.algorithm !== 'Ed25519'
    || typeof signature.key_id !== 'string' || signature.key_id.trim().length === 0
    || typeof signature.value !== 'string' || signature.value.length === 0) {
    throw new ClientSignatureError('signature envelope signature block is invalid');
  }
  if (typeof actorId !== 'string' || actorId.trim().length === 0) {
    throw new ClientSignatureError('authenticated actor is required for signature verification', 'CLIENT_SIGNATURE_ACTOR_MISSING', 401);
  }
  const envelopePayload = canonicalOrThrow(envelope.payload ?? null, 'payload');
  const requestPayload = canonicalOrThrow(payload ?? null, 'request payload');
  if (envelopePayload !== requestPayload) {
    throw new ClientSignatureError('signature envelope payload does not match the request', 'CLIENT_SIGNATURE_PAYLOAD_MISMATCH');
  }
  const signingBytes = Buffer.from(canonicalOrThrow({ event_type: envelope.event_type, payload: envelope.payload, nonce: envelope.nonce }, 'signing bytes'), 'utf8');
  if (typeof envelope.signing_bytes_hash !== 'string' || envelope.signing_bytes_hash !== `sha256:${rawHash(signingBytes.toString('utf8'))}`) {
    throw new ClientSignatureError('signature envelope signing bytes hash mismatch', 'CLIENT_SIGNATURE_HASH_MISMATCH');
  }
  if (!repository || typeof repository.findActiveSigningKey !== 'function') {
    throw new ClientSignatureError('signing key lookup is not configured', 'CLIENT_SIGNATURE_UNAVAILABLE', 503);
  }
  const signingKey = await repository.findActiveSigningKey(actorId.trim());
  if (!signingKey || signingKey.keyId !== signature.key_id.trim()) {
    throw new ClientSignatureError('no matching active signing key for this actor', 'CLIENT_SIGNATURE_KEY_NOT_FOUND');
  }
  if (signingKey.algorithm && signingKey.algorithm !== 'Ed25519') {
    throw new ClientSignatureError('signing key algorithm is not supported');
  }
  const verified = await verifyEd25519Payload({ signingBytes: new Uint8Array(signingBytes), signature: signature.value, publicKey: signingKey.publicKey });
  if (verified !== true) {
    throw new ClientSignatureError('signature verification failed', 'CLIENT_SIGNATURE_MISMATCH');
  }
  if (typeof repository.claimSignatureNonce !== 'function') {
    throw new ClientSignatureError('signature replay protection is not configured', 'CLIENT_SIGNATURE_UNAVAILABLE', 503);
  }
  const claimed = await repository.claimSignatureNonce({
    actorId: actorId.trim(),
    keyId: signingKey.keyId,
    nonce: envelope.nonce,
  });
  if (claimed !== true) {
    throw new ClientSignatureError('signature nonce has already been used', 'CLIENT_SIGNATURE_REPLAYED', 409);
  }
  return Object.freeze({ verified: true, keyId: signingKey.keyId });
}
