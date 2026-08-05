import test from "node:test";
import assert from "node:assert/strict";
import { getQuestion, listQuestions } from "../src/question-query.mjs";

const questions = [
  { questionId: "question-2", projectId: "project-1", state: "draft", createdAt: "2026-08-02T00:00:00.000Z" },
  { questionId: "question-1", projectId: "project-1", state: "proposed", createdAt: "2026-08-01T00:00:00.000Z" },
  { questionId: "question-3", projectId: "project-2", state: "draft", createdAt: "2026-08-03T00:00:00.000Z" },
];

test("lists questions by project and state with stable cursor pagination", async () => {
  const repository = { listQuestions: async ({ projectId, state }) => questions.filter((question) => (!projectId || question.projectId === projectId) && (!state || question.state === state)) };
  const first = await listQuestions({ repository, projectId: "project-1", limit: 1 });
  const second = await listQuestions({ repository, projectId: "project-1", limit: 1, cursor: first.nextCursor });
  assert.deepEqual(first.items.map(({ questionId }) => questionId), ["question-1"]);
  assert.deepEqual(second.items.map(({ questionId }) => questionId), ["question-2"]);
});

test("returns the current question revision and its contract revision", async () => {
  const result = await getQuestion({
    repository: {
      getQuestion: async (questionId) => ({ questionId, state: "draft" }),
      getCurrentQuestionRevision: async () => ({ questionId: "question-1", revision: 1, researchContract: { contractId: "contract-1", revision: 2 } }),
      getResearchContractRevision: async (contractId, revision) => ({ contractId, revision, riskLevel: "open" }),
    },
    questionId: "question-1",
  });
  assert.equal(result.currentRevision.revision, 1);
  assert.deepEqual(result.contract, { contractId: "contract-1", revision: 2, riskLevel: "open" });
});

test("returns a typed not-found error for an unknown question", async () => {
  await assert.rejects(
    getQuestion({ repository: { getQuestion: async () => null, getCurrentQuestionRevision: async () => null, getResearchContractRevision: async () => null }, questionId: "missing" }),
    (error) => error.code === "QUESTION_NOT_FOUND" && error.status === 404,
  );
});
