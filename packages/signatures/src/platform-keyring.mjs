import { createKeyRotationDeclaration } from './key-rotation.mjs';
import { verifyPlatformReceipt } from './platform-receipt.mjs';

export class PlatformKeyringError extends Error {
  constructor(message, code = 'PLATFORM_KEYRING_INVALID') {
    super(message);
    this.name = 'PlatformKeyringError';
    this.code = code;
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new PlatformKeyringError(`${field} must be a non-empty string`);
  return value.trim();
}

function normalizeKey(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PlatformKeyringError(`${field} must be an object`);
  return Object.freeze({ keyId: requiredText(value.keyId, `${field}.keyId`), publicKey: requiredText(value.publicKey, `${field}.publicKey`) });
}

/** Create a keyring that retains public verification material for historical receipts. */
export function createPlatformKeyring({ activeKey, retiredKeys = [] } = {}) {
  const active = normalizeKey(activeKey, 'active key');
  if (!Array.isArray(retiredKeys)) throw new PlatformKeyringError('retired keys must be an array');
  const retired = retiredKeys.map((key) => normalizeKey(key, 'retired key'));
  const keyIds = [active, ...retired].map((key) => key.keyId);
  if (new Set(keyIds).size !== keyIds.length) throw new PlatformKeyringError('platform key IDs must be unique');
  return Object.freeze({ activeKey: active, retiredKeys: Object.freeze(retired) });
}

/** Rotate the active platform signing key while retaining its public key for historical verification. */
export async function rotatePlatformKeyring({ keyring, newKey, oldPrivateKey } = {}) {
  const current = createPlatformKeyring(keyring);
  const next = normalizeKey(newKey, 'new key');
  if ([current.activeKey, ...current.retiredKeys].some((key) => key.keyId === next.keyId)) {
    throw new PlatformKeyringError('new platform key ID must not already exist', 'PLATFORM_KEY_ALREADY_EXISTS');
  }
  const declaration = await createKeyRotationDeclaration({
    oldKeyId: current.activeKey.keyId,
    newKeyId: next.keyId,
    newPublicKey: next.publicKey,
    oldPrivateKey: requiredText(oldPrivateKey, 'old private key'),
  });
  return Object.freeze({
    declaration,
    keyring: createPlatformKeyring({ activeKey: next, retiredKeys: [current.activeKey, ...current.retiredKeys] }),
  });
}

/** Verify a platform receipt using its key_id against active and retained public keys. */
export async function verifyPlatformReceiptWithKeyring({ receipt, keyring } = {}) {
  try {
    const normalized = createPlatformKeyring(keyring);
    const keyId = requiredText(receipt?.server_signature?.key_id, 'receipt platform key id');
    const key = [normalized.activeKey, ...normalized.retiredKeys].find((candidate) => candidate.keyId === keyId);
    return key ? await verifyPlatformReceipt({ receipt, publicKey: key.publicKey }) : false;
  } catch {
    return false;
  }
}
