import test from "node:test";
import assert from "node:assert/strict";
import { createQuestion, transitionQuestion } from "../src/question-command.mjs";

function repositoryFixture() {
  const calls = [];
  const repository = {
    withTransaction: (callback) => callback(repository),
    insertQuestion: async (value) => { calls.push(["question", value]); return value; },
    insertQuestionRevision: async (value) => { calls.push(["revision", value]); return value; },
    appendResearchEvent: async (value) => { calls.push(["event", value]); return value; },
  };
  return { repository, calls };
}

test("creates a Question revision with an immutable contract reference and event", async () => {
  const { repository, calls } = repositoryFixture();
  const result = await createQuestion({
    repository,
    actorId: "actor-1",
    actorRole: "maintainer",
    questionId: "question-1",
    projectId: "project-1",
    title: "Does the claim hold?",
    statement: "A falsifiable research question.",
    researchContract: { contractId: "contract-1", revision: 2 },
    eventFactory: async ({ eventType, payload }) => ({ eventId: "event-3", eventType, payload }),
  });

  assert.deepEqual(calls.map(([kind]) => kind), ["question", "revision", "event"]);
  assert.equal(result.question.state, "draft");
  assert.equal(result.revision.revision, 1);
  assert.deepEqual(result.revision.researchContract, { contractId: "contract-1", revision: 2 });
  assert.equal(result.event.eventType, "question.created");
});

test("rejects a viewer write and malformed contract references before the transaction", async () => {
  const { repository } = repositoryFixture();
  await assert.rejects(
    createQuestion({
      repository,
      actorId: "actor-1",
      actorRole: "viewer",
      questionId: "question-1",
      projectId: "project-1",
      title: "Title",
      statement: "Statement",
      researchContract: { contractId: "contract-1", revision: 1 },
      eventFactory: () => ({}),
    }),
    /insufficient/,
  );
  await assert.rejects(
    createQuestion({
      repository,
      actorId: "actor-1",
      actorRole: "maintainer",
      questionId: "question-1",
      projectId: "project-1",
      title: "Title",
      statement: "Statement",
      researchContract: { contractId: "contract-1", revision: 0 },
      eventFactory: () => ({}),
    }),
    /revision must be positive/,
  );
});

test("moves a Question through valid states and records the transition event", async () => {
  const calls = [];
  const repository = {
    withTransaction: (callback) => callback(repository),
    getQuestionState: async () => ({ questionId: "question-1", state: "draft" }),
    updateQuestion: async (questionId, value) => { calls.push(["question", questionId, value]); return { questionId, ...value }; },
    appendResearchEvent: async (value) => { calls.push(["event", value]); return value; },
  };
  const result = await transitionQuestion({
    repository,
    actorId: "actor-1",
    actorRole: "maintainer",
    questionId: "question-1",
    toState: "proposed",
    eventFactory: async ({ eventType, payload }) => ({ eventId: "event-4", eventType, payload }),
  });
  assert.equal(result.question.state, "proposed");
  assert.equal(result.event.eventType, "question.state_changed");
  assert.deepEqual(calls.map(([kind]) => kind), ["question", "event"]);
});

test("rejects an invalid Question transition with STATE_TRANSITION_INVALID", async () => {
  const repository = {
    withTransaction: (callback) => callback(repository),
    getQuestionState: async () => ({ questionId: "question-1", state: "draft" }),
    updateQuestion: async () => { throw new Error("must not write"); },
    appendResearchEvent: async () => { throw new Error("must not write"); },
  };
  await assert.rejects(
    transitionQuestion({ repository, actorId: "actor-1", actorRole: "maintainer", questionId: "question-1", toState: "active", eventFactory: () => ({}) }),
    (error) => error.code === "STATE_TRANSITION_INVALID" && error.status === 409,
  );
});

test("allows an open Question to transition through an automatic publication path", async () => {
  const { repository } = repositoryFixture();
  repository.getQuestionState = async () => ({ questionId: "question-1", state: "draft" });
  repository.updateQuestion = async (questionId, value) => ({ questionId, ...value });

  const result = await transitionQuestion({
    repository,
    actorId: "actor-1",
    actorRole: "maintainer",
    questionId: "question-1",
    toState: "proposed",
    automaticPublication: true,
    riskSignals: [],
    eventFactory: async ({ eventType, payload }) => ({ eventId: "event-5", eventType, payload }),
  });

  assert.equal(result.question.state, "proposed");
});

for (const [risk, signals, code] of [
  ["moderated", ["missing_evidence"], "QUESTION_RISK_REVIEW_REQUIRED"],
  ["restricted", ["personal_data"], "QUESTION_RISK_RESTRICTED"],
  ["prohibited", ["malicious_file"], "QUESTION_RISK_PROHIBITED"],
]) {
  test(`blocks automatic publication for a ${risk} Question`, async () => {
    const { repository } = repositoryFixture();
    repository.getQuestionState = async () => { throw new Error("must not read state"); };
    repository.updateQuestion = async () => { throw new Error("must not update question"); };

    await assert.rejects(
      transitionQuestion({
        repository,
        actorId: "actor-1",
        actorRole: "maintainer",
        questionId: "question-1",
        toState: "proposed",
        automaticPublication: true,
        riskSignals: signals,
        eventFactory: () => ({ eventId: "event-6" }),
      }),
      (error) => error.code === code && error.status === 409,
    );
  });
}

test("normalizes, trims, dedupes, and bounds question topics", async () => {
  const { repository, calls } = repositoryFixture();
  await createQuestion({
    repository,
    actorId: "actor-1",
    actorRole: "maintainer",
    questionId: "question-1",
    projectId: "project-1",
    title: "Does the claim hold?",
    statement: "A falsifiable research question.",
    topics: [" reproducibility ", "", "representation learning", "reproducibility"],
    researchContract: { contractId: "contract-1", revision: 1 },
    eventFactory: async ({ eventType, payload }) => ({ eventId: "event-1", eventType, payload }),
  });

  assert.deepEqual(
    calls.find(([kind]) => kind === "question")[1].topics,
    ["reproducibility", "representation learning"],
  );
});

test("rejects non-string topics, overlong labels, and more than eight", async () => {
  const { repository } = repositoryFixture();
  const base = {
    repository,
    actorId: "actor-1",
    actorRole: "maintainer",
    questionId: "question-1",
    projectId: "project-1",
    title: "Title",
    statement: "Statement",
    researchContract: { contractId: "contract-1", revision: 1 },
    eventFactory: () => ({}),
  };
  await assert.rejects(createQuestion({ ...base, topics: "reproducibility" }), /topics must be an array/);
  await assert.rejects(createQuestion({ ...base, topics: [7] }), /topics must be an array/);
  await assert.rejects(createQuestion({ ...base, topics: ["x".repeat(49)] }), /at most 48 characters/);
  await assert.rejects(
    createQuestion({ ...base, topics: ["a", "b", "c", "d", "e", "f", "g", "h", "i"] }),
    /at most 8 topics/,
  );
  /* Omitted topics default to an empty array, never null. */
  const fresh = repositoryFixture();
  await createQuestion({ ...base, repository: fresh.repository });
  assert.deepEqual(fresh.calls.find(([kind]) => kind === "question")[1].topics, []);
});
