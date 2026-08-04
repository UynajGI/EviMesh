import { createHash } from 'node:crypto';

export const HASH_ALGORITHM = 'sha256';

function digest(value) {
  return createHash(HASH_ALGORITHM).update(value).digest('hex');
}

export function rawHash(value) {
  if (!(typeof value === 'string' || value instanceof Uint8Array)) {
    throw new TypeError('raw hash input must be a string or Uint8Array');
  }

  return digest(value);
}

function canonicalize(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('semantic hash input cannot contain a non-finite number');
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }

  throw new TypeError('semantic hash input must be JSON-compatible');
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function semanticHash(value) {
  return digest(Buffer.from(canonicalJson(value), 'utf8'));
}

export function createHashPair({ raw, semantic } = {}) {
  return Object.freeze({
    raw_hash: rawHash(raw),
    semantic_hash: semanticHash(semantic),
  });
}
