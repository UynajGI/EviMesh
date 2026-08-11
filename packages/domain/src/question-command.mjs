import { assertProjectRoleForAction } from "./project-authorization.mjs";
import { assertQuestionTransition } from "../../protocol/src/question-state.mjs";
import { canAutoPublishQuestion, classifyQuestionRisk } from "./risk-policy.mjs";

export class QuestionCommandError extends Error {
  constructor(message, code = "QUESTION_INVALID", status = 400) {
    super(message);
    this.name = "QuestionCommandError";
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new QuestionCommandError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeContractReference(reference) {
  if (!reference || typeof reference !== "object" || Array.isArray(reference)) {
    throw new QuestionCommandError("research contract reference is required");
  }
  const contractId = requiredText(reference.contractId, "research contract id");
  if (!Number.isInteger(reference.revision) || reference.revision < 1) {
    throw new QuestionCommandError("research contract revision must be positive");
  }
  return { contractId, revision: reference.revision };
}

function assertAutomaticPublicationAllowed({ riskSignals } = {}) {
  const classification = classifyQuestionRisk({ signals: riskSignals });
  if (canAutoPublishQuestion(classification)) return classification;

  const code = classification.risk === "prohibited"
    ? "QUESTION_RISK_PROHIBITED"
    : classification.risk === "restricted"
      ? "QUESTION_RISK_RESTRICTED"
      : "QUESTION_RISK_REVIEW_REQUIRED";
  throw new QuestionCommandError(
    `Question with ${classification.risk} risk cannot be automatically published`,
    code,
    409,
  );
}

/** Create a Question and its first revision, referencing an immutable Contract revision. */
export async function createQuestion({
  repository,
  actorId,
  actorRole,
  questionId,
  projectId,
  title,
  statement,
  researchContract,
  eventFactory,
} = {}) {
  if (!repository || typeof repository.withTransaction !== "function") {
    throw new QuestionCommandError("repository withTransaction is required");
  }
  for (const method of ["insertQuestion", "insertQuestionRevision", "appendResearchEvent"]) {
    if (typeof repository[method] !== "function") {
      throw new QuestionCommandError(`repository ${method} is required`);
    }
  }
  actorId = requiredText(actorId, "actor id");
  questionId = requiredText(questionId, "question id");
  projectId = requiredText(projectId, "project id");
  title = requiredText(title, "question title");
  statement = requiredText(statement, "question statement");
  const contract = normalizeContractReference(researchContract);
  if (typeof eventFactory !== "function") {
    throw new QuestionCommandError("eventFactory is required");
  }
  assertProjectRoleForAction({ actorRole, requiredRole: "maintainer" });

  const question = { questionId, projectId, state: "draft", createdBy: actorId };
  const revision = {
    questionId,
    revision: 1,
    supersedes: null,
    state: "draft",
    title,
    statement,
    researchContract: contract,
    createdBy: actorId,
  };
  const event = await eventFactory({
    eventType: "question.created",
    payload: { entity_type: "question", question_id: questionId, project_id: projectId, revision: 1, actor_id: actorId },
  });
  if (!event || typeof event !== "object") {
    throw new QuestionCommandError("eventFactory must return an event object");
  }

  return repository.withTransaction(async (transaction) => {
    const persistedQuestion = await transaction.insertQuestion(question);
    const persistedRevision = await transaction.insertQuestionRevision(revision);
    const persistedEvent = await transaction.appendResearchEvent(event);
    return {
      question: persistedQuestion ?? question,
      revision: persistedRevision ?? revision,
      event: persistedEvent ?? event,
    };
  });
}

/** Move a Question through the protocol state machine and append an audit event. */
export async function transitionQuestion({
  repository,
  actorId,
  actorRole,
  questionId,
  toState,
  automaticPublication = false,
  riskSignals,
  eventFactory,
} = {}) {
  if (!repository || typeof repository.withTransaction !== "function") {
    throw new QuestionCommandError("repository withTransaction is required");
  }
  for (const method of ["getQuestionState", "updateQuestion", "appendResearchEvent"]) {
    if (typeof repository[method] !== "function") throw new QuestionCommandError(`repository ${method} is required`);
  }
  actorId = requiredText(actorId, "actor id");
  questionId = requiredText(questionId, "question id");
  toState = requiredText(toState, "question state");
  if (typeof automaticPublication !== "boolean") {
    throw new QuestionCommandError("automatic publication must be a boolean");
  }
  if (typeof eventFactory !== "function") throw new QuestionCommandError("eventFactory is required");
  assertProjectRoleForAction({ actorRole, requiredRole: "maintainer" });
  if (automaticPublication) assertAutomaticPublicationAllowed({ riskSignals });

  return repository.withTransaction(async (transaction) => {
    const current = await transaction.getQuestionState(questionId);
    if (!current) throw new QuestionCommandError("question not found", "QUESTION_NOT_FOUND", 404);
    try {
      assertQuestionTransition(current.state, toState);
    } catch (error) {
      throw new QuestionCommandError(error.message, "STATE_TRANSITION_INVALID", 409);
    }
    const event = await eventFactory({
      eventType: "question.state_changed",
      payload: { entity_type: "question", question_id: questionId, from_state: current.state, to_state: toState, actor_id: actorId },
    });
    if (!event || typeof event !== "object") throw new QuestionCommandError("eventFactory must return an event object");
    const updated = await transaction.updateQuestion(questionId, { state: toState });
    const persistedEvent = await transaction.appendResearchEvent(event);
    return { question: updated ?? { ...current, state: toState }, event: persistedEvent ?? event };
  });
}
