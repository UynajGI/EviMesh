import test from "node:test";
import assert from "node:assert/strict";
import { createTask } from "../src/task-command.mjs";

function repositoryFixture() {
  const calls = [];
  const repository = {
    withTransaction: (callback) => callback(repository),
    insertTask: async (value) => { calls.push(["task", value]); return value; },
    insertTaskRevision: async (value) => { calls.push(["revision", value]); return value; },
    appendResearchEvent: async (value) => { calls.push(["event", value]); return value; },
  };
  return { repository, calls };
}

test("creates a Task revision with context and acceptance metadata", async () => {
  const { repository, calls } = repositoryFixture();
  const result = await createTask({
    repository,
    actorId: "actor-1",
    actorRole: "maintainer",
    taskId: "task-1",
    questionId: "question-1",
    title: "Verify a claim",
    description: "Run the independent verification task.",
    inputs: [{ artifactId: "artifact-1" }],
    outputs: [{ type: "report" }],
    acceptance: { checks: ["reproducible"] },
    contextMode: "blind",
    eventFactory: async ({ eventType, payload }) => ({ eventId: "event-6", eventType, payload }),
  });
  assert.deepEqual(calls.map(([kind]) => kind), ["task", "revision", "event"]);
  assert.equal(result.task.state, "draft");
  assert.equal(result.revision.revision, 1);
  assert.equal(result.revision.contextMode, "blind");
  assert.deepEqual(result.revision.acceptance, { checks: ["reproducible"] });
  assert.equal(result.event.eventType, "task.created");
});

test("rejects unsupported context modes before writing", async () => {
  const { repository } = repositoryFixture();
  await assert.rejects(
    createTask({
      repository,
      actorId: "actor-1",
      actorRole: "maintainer",
      taskId: "task-1",
      title: "Title",
      description: "Description",
      outputs: [],
      acceptance: {},
      contextMode: "unknown",
      eventFactory: () => ({}),
    }),
    /unsupported context mode/,
  );
});
