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
  publicKey = requiredText(publicKey, "public key");
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
