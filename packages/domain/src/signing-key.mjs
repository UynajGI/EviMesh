export class SigningKeyError extends Error {
  constructor(message, code = "SIGNING_KEY_INVALID") {
    super(message);
    this.name = "SigningKeyError";
    this.code = code;
  }
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SigningKeyError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export function assertCanonicalEd25519Spki(value) {
  const publicKey = requiredText(value, "public key");
  if (!/^[A-Za-z0-9_-]{59}$/.test(publicKey)) {
    throw new SigningKeyError("public key must be canonical unpadded Ed25519 SPKI base64url");
  }
  const decoded = Buffer.from(publicKey, 'base64url');
  if (decoded.length !== 44
      || !decoded.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
      || decoded.toString('base64url') !== publicKey) {
    throw new SigningKeyError("public key must contain the canonical 44-byte Ed25519 SPKI DER form");
  }
  return publicKey;
}

/** List an Actor's public verification keys, including revoked history. */
export async function listActorSigningKeys({ repository, actorId } = {}) {
  if (!repository || typeof repository.listSigningKeys !== "function") {
    throw new SigningKeyError("repository listSigningKeys is required");
  }
  return repository.listSigningKeys(requiredText(actorId, "actor id"));
}

/** Register one active signing key for an authenticated Actor. */
export async function registerActorSigningKey({
  repository,
  actorId,
  keyId,
  publicKey,
  algorithm = "Ed25519",
} = {}) {
  if (!repository || typeof repository.withTransaction !== "function") {
    throw new SigningKeyError("repository withTransaction is required");
  }
  if (typeof repository.findActiveSigningKey !== "function" || typeof repository.insertSigningKey !== "function") {
    throw new SigningKeyError("signing-key repository methods are required");
  }
  actorId = requiredText(actorId, "actor id");
  keyId = requiredText(keyId, "key id");
  publicKey = assertCanonicalEd25519Spki(publicKey);
  algorithm = requiredText(algorithm, "algorithm");
  if (algorithm !== "Ed25519") {
    throw new SigningKeyError("only Ed25519 signing keys are supported");
  }

  return repository.withTransaction(async (transaction) => {
    if (await transaction.findActiveSigningKey(actorId)) {
      throw new SigningKeyError("actor already has an active signing key", "SIGNING_KEY_ALREADY_ACTIVE");
    }
    const signingKey = { keyId, actorId, algorithm, publicKey };
    await transaction.insertSigningKey(signingKey);
    return signingKey;
  });
}

/** Revoke an active signing key owned by the authenticated Actor. */
export async function revokeActorSigningKey({ repository, actorId, keyId, reason = "revoked by owner" } = {}) {
  if (!repository || typeof repository.withTransaction !== "function") {
    throw new SigningKeyError("repository withTransaction is required");
  }
  if (typeof repository.revokeSigningKey !== "function") {
    throw new SigningKeyError("repository revokeSigningKey is required");
  }
  actorId = requiredText(actorId, "actor id");
  keyId = requiredText(keyId, "key id");
  reason = requiredText(reason, "revocation reason");

  return repository.withTransaction(async (transaction) => {
    const revoked = await transaction.revokeSigningKey(actorId, keyId, reason);
    if (!revoked) {
      throw new SigningKeyError("active signing key not found", "SIGNING_KEY_NOT_FOUND");
    }
    return revoked;
  });
}
