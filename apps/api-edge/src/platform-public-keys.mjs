import { createPlatformKeyring } from '../../../packages/signatures/src/platform-keyring.mjs';

export class PlatformPublicKeysError extends Error {
  constructor(message, code = 'PLATFORM_PUBLIC_KEYS_INVALID', status = 500) {
    super(message);
    this.name = 'PlatformPublicKeysError';
    this.code = code;
    this.status = status;
  }
}

/** Return a public-only platform key set suitable for receipt verification clients. */
export function getPlatformPublicKeys({ keyring } = {}) {
  try {
    const normalized = createPlatformKeyring(keyring);
    const keys = [normalized.activeKey, ...normalized.retiredKeys].map((key) => Object.freeze({
      key_id: key.keyId,
      algorithm: 'Ed25519',
      public_key: key.publicKey,
    }));
    return Object.freeze({ active_key_id: normalized.activeKey.keyId, keys: Object.freeze(keys) });
  } catch (error) {
    throw new PlatformPublicKeysError(`platform keyring is invalid: ${error.message}`);
  }
}
