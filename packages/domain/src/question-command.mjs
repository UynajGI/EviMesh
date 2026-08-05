import { assertProjectRoleForAction } from "./project-authorization.mjs";

export class QuestionCommandError extends Error {
  constructor(message, code = "QUESTION_INVALID") {
    super(message);
    this.name = "QuestionCommandError";
    this.code = code;
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
