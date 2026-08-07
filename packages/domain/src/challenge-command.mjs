import { assertProjectRoleForAction } from "./project-authorization.mjs";
import { assertChallengeTransition } from "../../protocol/src/challenge-state.mjs";

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

function assertIfMatch(ifMatch, currentEtag) {
  if (typeof currentEtag !== "string" || currentEtag.length === 0 || typeof ifMatch !== "string" || ifMatch.trim() !== currentEtag) {
    throw new ChallengeCommandError("If-Match does not match the current revision", "PRECONDITION_FAILED", 412);
  }
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

/** Append a Challenge revision for a validated lifecycle transition. */
export async function transitionChallenge({
  repository,
  actorId,
  actorRole,
  challengeId,
  toState,
  ifMatch,
  currentEtag,
  etagForRevision = null,
  eventFactory,
} = {}) {
  if (!repository || typeof repository.withTransaction !== "function") throw new ChallengeCommandError("repository withTransaction is required");
  for (const method of ["getCurrentChallengeRevision", "insertChallengeRevision", "appendResearchEvent"]) {
    if (typeof repository[method] !== "function") throw new ChallengeCommandError(`repository ${method} is required`);
  }
  actorId = requiredText(actorId, "actor id");
  challengeId = requiredText(challengeId, "challenge id");
  toState = requiredText(toState, "challenge state");
  if (typeof currentEtag !== "string" || currentEtag.length === 0) throw new ChallengeCommandError("current ETag is required");
  if (typeof eventFactory !== "function") throw new ChallengeCommandError("eventFactory is required");
  assertProjectRoleForAction({ actorRole, requiredRole: "maintainer" });

  return repository.withTransaction(async (transaction) => {
    const current = await transaction.getCurrentChallengeRevision(challengeId);
    if (!current) throw new ChallengeCommandError("current challenge revision not found", "CHALLENGE_REVISION_NOT_FOUND", 404);
    assertIfMatch(ifMatch, typeof etagForRevision === "function" ? etagForRevision(current) : currentEtag);
    try {
      assertChallengeTransition(current.state, toState);
    } catch (error) {
      throw new ChallengeCommandError(error.message, "STATE_TRANSITION_INVALID", 409);
    }
    const next = { ...current, challengeId, revision: current.revision + 1, state: toState, createdBy: actorId };
    delete next.createdAt;
    const eventType = toState === "upheld" ? "challenge.upheld" : "challenge.state_changed";
    const event = await eventFactory({
      eventType,
      payload: {
        entity_type: "challenge",
        challenge_id: challengeId,
        from_state: current.state,
        to_state: toState,
        revision: next.revision,
        target_claim_id: next.targetClaimId,
        target_claim_revision: next.targetClaimRevision,
        actor_id: actorId,
      },
    });
    if (!event || typeof event !== "object") throw new ChallengeCommandError("eventFactory must return an event object");
    const persistedRevision = await transaction.insertChallengeRevision(next);
    const persistedEvent = await transaction.appendResearchEvent(event);
    return { revision: persistedRevision ?? next, event: persistedEvent ?? event };
  });
}
