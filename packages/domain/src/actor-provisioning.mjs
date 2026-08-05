function assertText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function defaultActorIdFactory() {
  return `actor_${crypto.randomUUID()}`;
}

/**
 * Provision the stable EviMesh Actor for an authenticated provider identity.
 *
 * Repository contract:
 * - withTransaction(callback): runs callback with a transaction repository;
 * - findIdentity(provider, subject): returns an existing active identity or null;
 * - insertActor(actor): inserts a new actor;
 * - insertIdentity(identity): inserts the provider binding.
 */
export async function ensureActorForIdentity({
  repository,
  provider,
  subject,
  email = null,
  actorIdFactory = defaultActorIdFactory,
} = {}) {
  if (!repository || typeof repository.withTransaction !== "function") {
    throw new TypeError("repository withTransaction is required");
  }
  provider = assertText(provider, "provider");
  subject = assertText(subject, "subject");
  if (email !== null) email = assertText(email, "email");

  return repository.withTransaction(async (transaction) => {
    const existing = await transaction.findIdentity(provider, subject);
    if (existing) {
      return { actor: existing.actor, identity: existing, created: false };
    }

    const actorId = assertText(actorIdFactory(), "actor id");
    const actor = {
      actorId,
      actorType: "human",
      identityStrength: "verified",
    };
    const identity = {
      provider,
      subject,
      email,
      actorId,
    };
    await transaction.insertActor(actor);
    await transaction.insertIdentity(identity);
    return { actor, identity, created: true };
  });
}
