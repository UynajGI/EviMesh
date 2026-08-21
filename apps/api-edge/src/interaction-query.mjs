/*
 * Engagement interactions + recommendations (owner direction 2026-08-21).
 *
 * Personal navigation signals ("helpful" marks, saves) that feed the offline
 * collaborative-filtering trainer. Constitutional boundaries enforced here
 * and downstream: kinds are private signals — no public counts, no scores in
 * responses; recommendation rows are navigation entries for a labeled
 * "For you" surface and never reorder the chronological feed.
 */

export const INTERACTION_KINDS = Object.freeze(['helpful', 'favorite', 'watch', 'view']);

/* Object types a signal may target, mapped to their hosted table + id column
 * so existence can be probed before writing. */
export const INTERACTION_OBJECT_TABLES = Object.freeze({
  question: { table: 'questions', idColumn: 'question_id' },
  claim: { table: 'claims', idColumn: 'claim_id' },
  task: { table: 'tasks', idColumn: 'task_id' },
  project: { table: 'projects', idColumn: 'project_id' },
});

export class InteractionError extends Error {
  constructor(message, code = 'INTERACTION_INVALID', status = 400) {
    super(message);
    this.name = 'InteractionError';
    this.code = code;
    this.status = status;
  }
}

export function normalizeKind(kind) {
  if (typeof kind !== 'string' || !INTERACTION_KINDS.includes(kind)) {
    throw new InteractionError(`kind must be one of: ${INTERACTION_KINDS.join(', ')}`, 'INTERACTION_KIND_INVALID');
  }
  return kind;
}

export function normalizeObjectRef(objectType, objectId) {
  if (typeof objectType !== 'string' || !INTERACTION_OBJECT_TABLES[objectType]) {
    throw new InteractionError(`object type must be one of: ${Object.keys(INTERACTION_OBJECT_TABLES).join(', ')}`, 'INTERACTION_OBJECT_TYPE_INVALID');
  }
  if (typeof objectId !== 'string' || objectId.trim().length === 0 || objectId.trim().length > 256) {
    throw new InteractionError('object id must be a non-empty string of at most 256 characters', 'INTERACTION_OBJECT_ID_INVALID');
  }
  return { objectType, objectId: objectId.trim() };
}

function requireRepository(repository, method) {
  if (!repository || typeof repository[method] !== 'function') {
    throw new InteractionError(`repository ${method} is required`, 'INTERACTION_REPOSITORY_INVALID', 500);
  }
}

function requireAccessToken(accessToken) {
  if (typeof accessToken !== 'string' || accessToken.trim().length === 0) {
    throw new InteractionError('an authenticated Supabase session is required to change engagement signals', 'INTERACTION_AUTH_REQUIRED', 401);
  }
  return accessToken;
}

async function assertTargetExists(repository, objectType, objectId) {
  if (typeof repository.getInteractionTarget !== 'function') return;
  const target = await repository.getInteractionTarget(objectType, objectId);
  if (!target) throw new InteractionError(`${objectType} ${objectId} was not found`, 'INTERACTION_TARGET_NOT_FOUND', 404);
}

/** Idempotently record one personal signal for the authenticated actor. */
export async function recordInteraction({ repository, accessToken, actorId, objectType, objectId, kind } = {}) {
  requireRepository(repository, 'recordInteraction');
  requireAccessToken(accessToken);
  if (typeof actorId !== 'string' || !actorId.trim()) throw new InteractionError('actor id is required');
  kind = normalizeKind(kind);
  ({ objectType, objectId } = normalizeObjectRef(objectType, objectId));
  await assertTargetExists(repository, objectType, objectId);
  await repository.recordInteraction({ accessToken, actorId, objectType, objectId, kind });
  return { objectType, objectId, kind, recorded: true };
}

/** Remove one personal signal (toggle off). */
export async function removeInteraction({ repository, accessToken, actorId, objectType, objectId, kind } = {}) {
  requireRepository(repository, 'removeInteraction');
  requireAccessToken(accessToken);
  if (typeof actorId !== 'string' || !actorId.trim()) throw new InteractionError('actor id is required');
  kind = normalizeKind(kind);
  ({ objectType, objectId } = normalizeObjectRef(objectType, objectId));
  await repository.removeInteraction({ accessToken, actorId, objectType, objectId, kind });
  return { objectType, objectId, kind, recorded: false };
}

/** List the caller's own signals, optionally narrowed by kinds. */
export async function listMyInteractions({ repository, accessToken, actorId, kinds = null } = {}) {
  requireRepository(repository, 'listInteractionsForActor');
  requireAccessToken(accessToken);
  if (typeof actorId !== 'string' || !actorId.trim()) throw new InteractionError('actor id is required');
  let normalized = null;
  if (kinds !== null && kinds !== undefined) {
    const list = Array.isArray(kinds) ? kinds : [kinds];
    normalized = list.map(normalizeKind);
  }
  const rows = await repository.listInteractionsForActor({ accessToken, actorId, kinds: normalized });
  return Array.isArray(rows) ? rows : [];
}

/**
 * Personal "For you" entries from the offline recommendation cache.
 * Returns navigation refs only — no scores ever leave the boundary.
 */
export async function getMyRecommendations({ repository, accessToken, actorId, limit = 12 } = {}) {
  requireRepository(repository, 'listRecommendationsForActor');
  requireAccessToken(accessToken);
  if (typeof actorId !== 'string' || !actorId.trim()) throw new InteractionError('actor id is required');
  const bounded = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 24) : 12;
  const rows = await repository.listRecommendationsForActor({ accessToken, actorId, limit: bounded });
  const items = Array.isArray(rows) ? rows : [];
  if (items.length === 0) {
    return { items: [], generatedAt: null, model: null, reason: 'no_recommendations_yet' };
  }
  return {
    items: items.map((row) => ({
      objectType: row.objectType,
      objectId: row.objectId,
      reason: typeof row.reason === 'string' ? row.reason : null,
      generatedAt: row.generatedAt ?? null,
    })),
    generatedAt: items[0]?.generatedAt ?? null,
    model: items[0]?.model ?? null,
    reason: 'from_your_activity',
  };
}

/**
 * Self-provision the actor + identity binding for a logged-in Supabase user.
 * Idempotent: an existing binding returns the bound actor with created=false.
 */
export async function provisionSelfActor({ repository, accessToken, claims } = {}) {
  requireRepository(repository, 'provisionSelfActor');
  requireAccessToken(accessToken);
  const subject = typeof claims?.sub === 'string' ? claims.sub.trim() : '';
  if (!subject) throw new InteractionError('authenticated subject is required', 'INTERACTION_AUTH_REQUIRED', 401);
  return repository.provisionSelfActor({
    accessToken,
    subject,
    email: typeof claims?.email === 'string' && claims.email.trim() ? claims.email.trim() : null,
  });
}
