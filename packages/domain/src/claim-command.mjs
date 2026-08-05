import { assertProjectRoleForAction } from "./project-authorization.mjs";

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
  const event = await eventFactory({
    eventType: "claim.created",
    payload: { entity_type: "claim", claim_id: claimId, question_id: questionId, revision: 1, actor_id: actorId },
  });
  if (!event || typeof event !== "object") throw new ClaimCommandError("eventFactory must return an event object");
  return repository.withTransaction(async (transaction) => {
    const persistedClaim = await transaction.insertClaim(claim);
    const persistedRevision = await transaction.insertClaimRevision(revision);
    const persistedEvent = await transaction.appendResearchEvent(event);
    return { claim: persistedClaim ?? claim, revision: persistedRevision ?? revision, event: persistedEvent ?? event };
  });
}
