const PROFILE_FIELDS = Object.freeze(["displayName", "bio", "avatarUrl"]);
const PROFILE_FIELD_SET = new Set(PROFILE_FIELDS);

export class ActorProfileError extends Error {
  constructor(message, code = "ACTOR_PROFILE_INVALID") {
    super(message);
    this.name = "ActorProfileError";
    this.code = code;
  }
}

function assertActorId(actorId) {
  if (typeof actorId !== "string" || actorId.trim().length === 0) {
    throw new ActorProfileError("actor id must be a non-empty string");
  }
  return actorId.trim();
}

function normalizePatch(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new ActorProfileError("profile patch must be an object");
  }
  const unknown = Object.keys(patch).filter((field) => !PROFILE_FIELD_SET.has(field));
  if (unknown.length > 0) {
    throw new ActorProfileError(`unsupported profile field: ${unknown[0]}`);
  }
  if (Object.keys(patch).length === 0) {
    throw new ActorProfileError("profile patch cannot be empty");
  }
  for (const [field, value] of Object.entries(patch)) {
    if (value !== null && typeof value !== "string") {
      throw new ActorProfileError(`${field} must be a string or null`);
    }
  }
  return { ...patch };
}

/**
 * Update only the profile belonging to the authenticated Actor.
 *
 * The repository must provide `withTransaction` and
 * `updateActorProfile(actorId, patch)`. The repository implementation must
 * apply the actor_id predicate in its UPDATE statement and return null when
 * no owned profile exists.
 */
export async function updateOwnActorProfile({ repository, actorId, patch } = {}) {
  if (!repository || typeof repository.withTransaction !== "function") {
    throw new ActorProfileError("repository withTransaction is required");
  }
  if (typeof repository.updateActorProfile !== "function") {
    throw new ActorProfileError("repository updateActorProfile is required");
  }
  actorId = assertActorId(actorId);
  patch = normalizePatch(patch);

  return repository.withTransaction(async (transaction) => {
    const updated = await transaction.updateActorProfile(actorId, patch);
    if (!updated) {
      throw new ActorProfileError("actor profile not found", "ACTOR_PROFILE_NOT_FOUND");
    }
    return updated;
  });
}
