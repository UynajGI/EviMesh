import { assertProjectRoleForAction } from "./project-authorization.mjs";
import { assertClaimTransition } from "../../protocol/src/claim-state.mjs";

export class ClaimCommandError extends Error {
  constructor(message, code = "CLAIM_INVALID", status = 400) {
    super(message);
    this.name = "ClaimCommandError";
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) throw new ClaimCommandError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredJson(value, field) {
  if (value === undefined || value === null || typeof value !== "object") throw new ClaimCommandError(`${field} must be a JSON object or array`);
  return value;
}

function assertIfMatch(ifMatch, currentEtag) {
  if (typeof ifMatch !== "string" || ifMatch.trim().length === 0 || ifMatch.trim() !== currentEtag) {
    throw new ClaimCommandError("If-Match does not match the current revision", "PRECONDITION_FAILED", 412);
  }
}

/** Create a Claim and its first immutable hypothesis revision atomically. */
export async function createClaim({
  repository,
  actorId,
  actorRole,
  claimId,
  questionId = null,
  statement,
  scope,
  assumptions = [],
  falsification,
  eventFactory,
} = {}) {
  if (!repository || typeof repository.withTransaction !== "function") throw new ClaimCommandError("repository withTransaction is required");
  for (const method of ["insertClaim", "insertClaimRevision", "appendResearchEvent"]) {
    if (typeof repository[method] !== "function") throw new ClaimCommandError(`repository ${method} is required`);
  }
  actorId = requiredText(actorId, "actor id");
  claimId = requiredText(claimId, "claim id");
  if (questionId !== null) questionId = requiredText(questionId, "question id");
  statement = requiredText(statement, "claim statement");
  scope = requiredJson(scope, "claim scope");
  assumptions = requiredJson(assumptions, "claim assumptions");
  falsification = requiredJson(falsification, "claim falsification");
  if (typeof eventFactory !== "function") throw new ClaimCommandError("eventFactory is required");
  assertProjectRoleForAction({ actorRole, requiredRole: "maintainer" });

  const claim = { claimId, questionId, state: "hypothesis", createdBy: actorId };
  const revision = {
    claimId,
    revision: 1,
    supersedes: null,
    state: "hypothesis",
    statement,
    scope,
    assumptions,
    falsification,
    questionId,
    createdBy: actorId,
  };
  const projected = { claimId, questionId, state: "hypothesis" };
  const event = await eventFactory({
    eventType: "claim.created",
    payload: {
      entity_type: "claim", claim_id: claimId, question_id: questionId, revision: 1, actor_id: actorId,
      projection: { entity_type: "claim", entity_id: claimId, revision: 1, state: { claim: projected, revision } },
    },
  });
  if (!event || typeof event !== "object") throw new ClaimCommandError("eventFactory must return an event object");
  return repository.withTransaction(async (transaction) => {
    const persistedClaim = await transaction.insertClaim(claim);
    const persistedRevision = await transaction.insertClaimRevision(revision);
    const persistedEvent = await transaction.appendResearchEvent(event);
    return { claim: persistedClaim ?? claim, revision: persistedRevision ?? revision, event: persistedEvent ?? event };
  });
}

/** Append a Claim revision without mutating historical revision rows. */
export async function reviseClaim({
  repository,
  actorId,
  actorRole,
  claimId,
  ifMatch,
  currentEtag,
  questionId,
  statement,
  scope,
  assumptions,
  falsification,
  eventFactory,
} = {}) {
  if (!repository || typeof repository.withTransaction !== "function") throw new ClaimCommandError("repository withTransaction is required");
  for (const method of ["getCurrentClaimRevision", "insertClaimRevision", "updateClaim", "appendResearchEvent"]) {
    if (typeof repository[method] !== "function") throw new ClaimCommandError(`repository ${method} is required`);
  }
  actorId = requiredText(actorId, "actor id");
  claimId = requiredText(claimId, "claim id");
  if (typeof currentEtag !== "string" || currentEtag.length === 0) throw new ClaimCommandError("current ETag is required");
  if (typeof eventFactory !== "function") throw new ClaimCommandError("eventFactory is required");
  assertProjectRoleForAction({ actorRole, requiredRole: "maintainer" });

  return repository.withTransaction(async (transaction) => {
    const current = await transaction.getCurrentClaimRevision(claimId);
    if (!current) throw new ClaimCommandError("current claim revision not found", "CLAIM_REVISION_NOT_FOUND", 404);
    assertIfMatch(ifMatch, currentEtag);

    const nextQuestionId = questionId === undefined ? (current.questionId ?? null) : questionId === null ? null : requiredText(questionId, "question id");
    const next = {
      claimId,
      revision: current.revision + 1,
      supersedes: current.revision,
      state: current.state,
      statement: statement === undefined ? current.statement : requiredText(statement, "claim statement"),
      scope: scope === undefined ? current.scope : requiredJson(scope, "claim scope"),
      assumptions: assumptions === undefined ? current.assumptions : requiredJson(assumptions, "claim assumptions"),
      falsification: falsification === undefined ? current.falsification : requiredJson(falsification, "claim falsification"),
      questionId: nextQuestionId,
      createdBy: actorId,
    };
    const projected = { claimId, questionId: next.questionId, state: next.state };
    const event = await eventFactory({
      eventType: "claim.revised",
      payload: {
        entity_type: "claim", claim_id: claimId, revision: next.revision, actor_id: actorId,
        projection: { entity_type: "claim", entity_id: claimId, revision: next.revision, state: { claim: projected, revision: next } },
      },
    });
    if (!event || typeof event !== "object") throw new ClaimCommandError("eventFactory must return an event object");
    const persistedRevision = await transaction.insertClaimRevision(next);
    const persistedClaim = await transaction.updateClaim(claimId, projected);
    const persistedEvent = await transaction.appendResearchEvent(event);
    return { claim: persistedClaim ?? projected, revision: persistedRevision ?? next, event: persistedEvent ?? event };
  });
}

/** Append a Claim revision for a validated lifecycle transition. */
export async function transitionClaim({
  repository,
  actorId,
  actorRole,
  claimId,
  toState,
  ifMatch,
  currentEtag,
  eventFactory,
} = {}) {
  if (!repository || typeof repository.withTransaction !== "function") throw new ClaimCommandError("repository withTransaction is required");
  for (const method of ["getCurrentClaimRevision", "insertClaimRevision", "updateClaim", "appendResearchEvent"]) {
    if (typeof repository[method] !== "function") throw new ClaimCommandError(`repository ${method} is required`);
  }
  actorId = requiredText(actorId, "actor id");
  claimId = requiredText(claimId, "claim id");
  if (typeof currentEtag !== "string" || currentEtag.length === 0) throw new ClaimCommandError("current ETag is required");
  if (typeof eventFactory !== "function") throw new ClaimCommandError("eventFactory is required");
  assertProjectRoleForAction({ actorRole, requiredRole: "maintainer" });

  return repository.withTransaction(async (transaction) => {
    const current = await transaction.getCurrentClaimRevision(claimId);
    if (!current) throw new ClaimCommandError("current claim revision not found", "CLAIM_REVISION_NOT_FOUND", 404);
    assertIfMatch(ifMatch, currentEtag);
    try {
      assertClaimTransition(current.state, toState);
    } catch (error) {
      throw new ClaimCommandError(error.message, "STATE_TRANSITION_INVALID", 409);
    }
    const next = {
      ...current,
      claimId,
      revision: current.revision + 1,
      supersedes: current.revision,
      state: toState,
      createdBy: actorId,
    };
    delete next.createdAt;
    const projected = { claimId, questionId: next.questionId ?? null, state: next.state };
    const event = await eventFactory({
      eventType: "claim.state_changed",
      payload: {
        entity_type: "claim", claim_id: claimId, from_state: current.state, to_state: toState, revision: next.revision, actor_id: actorId,
        projection: { entity_type: "claim", entity_id: claimId, revision: next.revision, state: { claim: projected, revision: next } },
      },
    });
    if (!event || typeof event !== "object") throw new ClaimCommandError("eventFactory must return an event object");
    const persistedRevision = await transaction.insertClaimRevision(next);
    const persistedClaim = await transaction.updateClaim(claimId, projected);
    const persistedEvent = await transaction.appendResearchEvent(event);
    return { claim: persistedClaim ?? projected, revision: persistedRevision ?? next, event: persistedEvent ?? event };
  });
}
