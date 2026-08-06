import { registerActorSigningKey } from '../../../packages/domain/src/signing-key.mjs';

/** Register a browser-generated public key for the authenticated Actor only. */
export async function registerOwnSigningKey({ repository, actorId, keyId, publicKey } = {}) {
  return registerActorSigningKey({ repository, actorId, keyId, publicKey, algorithm: 'Ed25519' });
}
