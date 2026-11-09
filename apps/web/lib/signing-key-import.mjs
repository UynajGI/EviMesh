export const PUBLIC_KEY_SCHEMA = 'evimesh.signing-public-key.v1';

const PUBLIC_KEY_PATTERN = /^[A-Za-z0-9_-]{59}$/;
const KEY_ID_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/;
const FORBIDDEN_FIELD = /private|secret|cipher|seed|passphrase|kdf/i;

export class SigningKeyImportError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SigningKeyImportError';
  }
}

/**
 * Parse the record printed by `sq key export-public`. Only the public half is
 * accepted; anything that looks like private or encrypted key material is
 * refused before it can leave the page.
 */
export function parseExportedPublicKey(text) {
  if (typeof text !== 'string' || !text.trim()) throw new SigningKeyImportError('Paste the output of sq key export-public.');
  if (/BEGIN [A-Z ]*PRIVATE KEY/.test(text)) throw new SigningKeyImportError('That is a private key. Never paste private key material into a browser.');
  let record;
  try {
    record = JSON.parse(text);
  } catch {
    throw new SigningKeyImportError('The exported record is not valid JSON.');
  }
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new SigningKeyImportError('The exported record must be a JSON object.');
  if (Object.keys(record).some((field) => FORBIDDEN_FIELD.test(field))) {
    throw new SigningKeyImportError('The record contains private key fields. Export only the public key with sq key export-public.');
  }
  if (record.schema !== PUBLIC_KEY_SCHEMA) throw new SigningKeyImportError(`Expected schema ${PUBLIC_KEY_SCHEMA}.`);
  if (record.algorithm !== 'Ed25519') throw new SigningKeyImportError('Only Ed25519 signing keys are supported.');
  if (typeof record.keyId !== 'string' || !KEY_ID_PATTERN.test(record.keyId)) throw new SigningKeyImportError('The record has no valid key id.');
  if (typeof record.publicKey !== 'string' || !PUBLIC_KEY_PATTERN.test(record.publicKey)) {
    throw new SigningKeyImportError('The public key must be a canonical base64url Ed25519 SPKI value.');
  }
  if (record.state && record.state !== 'active') throw new SigningKeyImportError('This local key is disabled. Create a new key with sq key create.');
  const label = typeof record.label === 'string' && record.label.trim() ? record.label.trim().slice(0, 200) : 'Signing key';
  return Object.freeze({ keyId: record.keyId, publicKey: record.publicKey, label });
}
