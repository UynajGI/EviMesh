import { paginate } from "./pagination.mjs";

export class QuestionQueryError extends Error {
  constructor(message, code = "QUESTION_QUERY_INVALID", status = 400) {
    super(message);
    this.name = "QuestionQueryError";
    this.code = code;
    this.status = status;
  }
}

function requiredId(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new QuestionQueryError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

export async function listQuestions({ repository, projectId = null, state = null, limit = 20, cursor = null } = {}) {
  if (!repository || typeof repository.listQuestions !== "function") {
    throw new QuestionQueryError("repository listQuestions is required");
  }
  if (projectId !== null) projectId = requiredId(projectId, "project id");
  if (state !== null) state = requiredId(state, "question state");
  const questions = await repository.listQuestions({ projectId, state });
  return paginate(questions, { limit, cursor, getKey: (question) => ({ createdAt: question.createdAt, id: question.questionId }) });
}

export async function getQuestion({ repository, questionId } = {}) {
  questionId = requiredId(questionId, "question id");
  if (!repository || typeof repository.getQuestion !== "function" || typeof repository.getCurrentQuestionRevision !== "function" || typeof repository.getResearchContractRevision !== "function") {
    throw new QuestionQueryError("repository question detail methods are required");
  }
  const question = await repository.getQuestion(questionId);
  if (!question) throw new QuestionQueryError("question not found", "QUESTION_NOT_FOUND", 404);
  const currentRevision = await repository.getCurrentQuestionRevision(questionId);
  if (!currentRevision) throw new QuestionQueryError("current question revision not found", "QUESTION_REVISION_NOT_FOUND", 500);
  const contractReference = currentRevision.researchContract;
  const contract = await repository.getResearchContractRevision(contractReference.contractId, contractReference.revision);
  if (!contract) throw new QuestionQueryError("research contract revision not found", "CONTRACT_REVISION_NOT_FOUND", 500);
  return { question, currentRevision, contract };
}
