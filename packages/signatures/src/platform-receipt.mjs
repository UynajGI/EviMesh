import { createPlatformReceipt } from '../../protocol/src/platform-receipt.mjs';
import { signEd25519Payload } from './client-signature.mjs';
import { verifyEd25519Payload } from './server-verification.mjs';

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function signingBytes({ eventId, serverTime }) {
  return new TextEncoder().encode(JSON.stringify({
    schema: 'srp.platform-receipt.v1',
    event_id: eventId,
    server_time: serverTime,
  }));
}

/** Sign a platform receipt over its stable event ID and server timestamp. */
export async function createSignedPlatformReceipt({ eventId, serverTime, keyId, privateKey } = {}) {
  keyId = requiredText(keyId, 'platform key id');
  const unsigned = createPlatformReceipt({ eventId, serverTime, serverSignature: { algorithm: 'Ed25519', key_id: keyId, value: 'pending' } });
  const value = await signEd25519Payload({ signingBytes: signingBytes({ eventId: unsigned.event_id, serverTime: unsigned.server_time }), privateKey });
  return createPlatformReceipt({
    eventId: unsigned.event_id,
    serverTime: unsigned.server_time,
    serverSignature: { algorithm: 'Ed25519', key_id: keyId, value },
  });
}

/** Verify one platform receipt against the published platform Ed25519 public key. */
export async function verifyPlatformReceipt({ receipt, publicKey } = {}) {
  try {
    const normalized = createPlatformReceipt({
      eventId: receipt?.event_id,
      serverTime: receipt?.server_time,
      serverSignature: receipt?.server_signature,
    });
    if (normalized.server_signature.algorithm !== 'Ed25519') return false;
    requiredText(normalized.server_signature.key_id, 'platform key id');
    return verifyEd25519Payload({
      signingBytes: signingBytes({ eventId: normalized.event_id, serverTime: normalized.server_time }),
      signature: normalized.server_signature.value,
      publicKey,
    });
  } catch {
    return false;
  }
}
