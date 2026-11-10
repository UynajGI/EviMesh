import { canonicalJson, rawHash } from '../../../packages/protocol/src/hash.mjs';
import { createResearchEvent } from '../../../packages/protocol/src/research-event.mjs';
import { signEd25519Payload } from '../../../packages/signatures/src/client-signature.mjs';
import { verifyEd25519Payload } from '../../../packages/signatures/src/server-verification.mjs';

export class PlatformResearchEventFactoryError extends Error {
  constructor(message, code = 'PLATFORM_EVENT_SIGNING_UNAVAILABLE') {
    super(message);
    this.name = 'PlatformResearchEventFactoryError';
    this.code = code;
    this.status = 503;
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new PlatformResearchEventFactoryError(`${field} must be a non-empty canonical string`);
  }
  return value;
}

function normalizedParents(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new PlatformResearchEventFactoryError('platform event parents must be an array');
  }
  return Object.freeze([...value]);
}

function signingDocument({ eventType, payload, parents }) {
  return canonicalJson({ event_type: eventType, payload, parents });
}

/**
 * Create the only platform ResearchEvent signer used by the hosted mutation
 * path. The private PKCS#8 key remains a Worker secret; callers receive only
 * a factory and the resulting signed event.
 */
export function createPlatformResearchEventFactory({
  keyId,
  privateKey,
  publicKey,
  parents = [],
} = {}) {
  keyId = requiredText(keyId, 'platform signing key id');
  privateKey = requiredText(privateKey, 'platform signing private key');
  publicKey = requiredText(publicKey, 'platform signing public key');
  const defaultParents = normalizedParents(parents);

  return async function platformResearchEventFactory({
    eventType,
    payload,
    parents: eventParents = defaultParents,
  } = {}) {
    eventType = requiredText(eventType, 'platform event type');
    const normalizedEventParents = normalizedParents(eventParents);
    let bytes;
    try {
      bytes = new TextEncoder().encode(signingDocument({
        eventType,
        payload,
        parents: normalizedEventParents,
      }));
    } catch (error) {
      throw new PlatformResearchEventFactoryError(`platform event payload is not canonical JSON: ${error.message}`);
    }
    const value = await signEd25519Payload({ signingBytes: bytes, privateKey });
    if (!await verifyEd25519Payload({ signingBytes: bytes, signature: value, publicKey })) {
      throw new PlatformResearchEventFactoryError(
        'platform signing private key does not match the active public key',
        'PLATFORM_EVENT_SIGNING_KEY_MISMATCH',
      );
    }
    return createResearchEvent({
      eventType,
      payload,
      parents: normalizedEventParents,
      hash: `sha256:${rawHash(new TextDecoder().decode(bytes))}`,
      signature: Object.freeze({ algorithm: 'Ed25519', key_id: keyId, value }),
    });
  };
}

/**
 * Resolve the active public key from PLATFORM_KEYRING and keep the matching
 * private material in the separate PLATFORM_EVENT_SIGNING_PRIVATE_KEY secret.
 * Missing or malformed configuration returns null so capability discovery
 * remains conservative and the submit route stays disabled.
 */
export function createPlatformResearchEventFactoryFromEnv({ env } = {}) {
  if (!env || typeof env !== 'object') return null;
  const privateKey = env.PLATFORM_EVENT_SIGNING_PRIVATE_KEY;
  if (typeof privateKey !== 'string' || !privateKey) return null;
  try {
    const keyring = JSON.parse(env.PLATFORM_KEYRING ?? '');
    const activeKey = keyring?.activeKey;
    const keyId = env.PLATFORM_EVENT_SIGNING_KEY_ID ?? activeKey?.keyId;
    if (keyId !== activeKey?.keyId) return null;
    return createPlatformResearchEventFactory({
      keyId,
      privateKey,
      publicKey: activeKey?.publicKey,
    });
  } catch {
    return null;
  }
}
