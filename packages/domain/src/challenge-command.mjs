import { assertProjectRoleForAction } from "./project-authorization.mjs";

export class ChallengeCommandError extends Error {
  constructor(message, code = "CHALLENGE_INVALID", status = 400) {
    super(message);
    this.name = "ChallengeCommandError";
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) throw new ChallengeCommandError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredJson(value, field) {
  if (value === undefined || value === null || typeof value !== "object" || Array.isArray(value)) throw new ChallengeCommandError(`${field} must be a JSON object`);
  return value;
}

/** Create a Challenge locked to an existing immutable Claim revision. */
export async function createChallenge({
  repository,
  actorId,
  actorRole,
  challengeId,
  targetClaimId,
  targetClaimRevision,
  reason,
  impact,
  proposedResolution = null,
  eventFactory,
} = {}) {
  if (!repository || typeof repository.withTransaction !== "function") throw new ChallengeCommandError("repository withTransaction is required");
  for (const method of ["getClaimRevision", "insertChallenge", "insertChallengeRevision", "appendResearchEvent"]) {
    if (typeof repository[method] !== "function") throw new ChallengeCommandError(`repository ${method} is required`);
  }
  actorId = requiredText(actorId, "actor id");
  challengeId = requiredText(challengeId, "challenge id");
  targetClaimId = requiredText(targetClaimId, "target claim id");
  if (!Number.isInteger(targetClaimRevision) || targetClaimRevision < 1) throw new ChallengeCommandError("target claim revision must be a positive integer");
  reason = requiredText(reason, "challenge reason");
  impact = requiredJson(impact, "challenge impact");
  if (proposedResolution !== null) proposedResolution = requiredText(proposedResolution, "proposed resolution");
  if (typeof eventFactory !== "function") throw new ChallengeCommandError("eventFactory is required");
  assertProjectRoleForAction({ actorRole, requiredRole: "contributor" });

  return repository.withTransaction(async (transaction) => {
    const targetRevision = await transaction.getClaimRevision(targetClaimId, targetClaimRevision);
    if (!targetRevision) throw new ChallengeCommandError("target claim revision not found", "TARGET_CLAIM_REVISION_NOT_FOUND", 404);
    const challenge = { challengeId, createdBy: actorId };
    const revision = {
      challengeId,
      revision: 1,
      state: "open",
      targetClaimId,
      targetClaimRevision,
      reason,
      impact,
      proposedResolution,
      createdBy: actorId,
    };
    const event = await eventFactory({
      eventType: "challenge.created",
      payload: { entity_type: "challenge", challenge_id: challengeId, target_claim_id: targetClaimId, target_claim_revision: targetClaimRevision, revision: 1, actor_id: actorId },
    });
    if (!event || typeof event !== "object") throw new ChallengeCommandError("eventFactory must return an event object");
    const persistedChallenge = await transaction.insertChallenge(challenge);
    const persistedRevision = await transaction.insertChallengeRevision(revision);
    const persistedEvent = await transaction.appendResearchEvent(event);
    return { challenge: persistedChallenge ?? challenge, revision: persistedRevision ?? revision, targetRevision, event: persistedEvent ?? event };
  });
}
