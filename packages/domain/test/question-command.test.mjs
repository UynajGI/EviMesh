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
