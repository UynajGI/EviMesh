import test from "node:test";
import assert from "node:assert/strict";
import { createTask, reviseTask, transitionTask } from "../src/task-command.mjs";

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

test("appends a task revision and updates only the current projection", async () => {
  const calls = [];
  const current = {
    taskId: "task-1",
    revision: 1,
    state: "draft",
    title: "Old title",
    description: "Old description",
    inputs: [],
    outputs: [{ type: "report" }],
    acceptance: { checks: ["old"] },
    contextMode: "blind",
    questionId: "question-1",
  };
  const repository = {
    withTransaction: (callback) => callback(repository),
    getCurrentTaskRevision: async () => current,
    insertTaskRevision: async (value) => { calls.push(["revision", value]); return value; },
    updateTask: async (taskId, value) => { calls.push(["task", taskId, value]); return value; },
    appendResearchEvent: async (value) => { calls.push(["event", value]); return value; },
  };
  const result = await reviseTask({
    repository,
    actorId: "actor-1",
    actorRole: "maintainer",
    taskId: "task-1",
    ifMatch: 'W/"task-1:1:abc"',
    currentEtag: 'W/"task-1:1:abc"',
    title: "New title",
    eventFactory: async ({ eventType, payload }) => ({ eventId: "event-7", eventType, payload }),
  });
  assert.deepEqual(calls.map(([kind]) => kind), ["revision", "task", "event"]);
  assert.equal(result.revision.revision, 2);
  assert.equal(result.revision.supersedes, 1);
  assert.equal(result.revision.title, "New title");
  assert.equal(result.revision.description, "Old description");
  assert.equal(result.task.taskId, "task-1");
  assert.equal(result.event.eventType, "task.revised");
});

test("rejects a stale task If-Match without writing", async () => {
  const calls = [];
  const repository = {
    withTransaction: (callback) => callback(repository),
    getCurrentTaskRevision: async () => ({ taskId: "task-1", revision: 2, state: "draft", title: "Title", description: "Description", inputs: [], outputs: [], acceptance: {}, contextMode: "blind" }),
    insertTaskRevision: async () => calls.push("revision"),
    updateTask: async () => calls.push("task"),
    appendResearchEvent: async () => calls.push("event"),
  };
  await assert.rejects(
    reviseTask({ repository, actorId: "actor-1", actorRole: "maintainer", taskId: "task-1", ifMatch: 'W/"task-1:1:old"', currentEtag: 'W/"task-1:2:new"', eventFactory: () => ({}) }),
    (error) => error.code === "PRECONDITION_FAILED" && error.status === 412,
  );
  assert.deepEqual(calls, []);
});

test("transitions a task through the protocol state machine", async () => {
  const calls = [];
  const current = {
    taskId: "task-1", revision: 1, state: "draft", title: "Title", description: "Description",
    inputs: [], outputs: [], acceptance: {}, contextMode: "blind", questionId: null,
  };
  const repository = {
    withTransaction: (callback) => callback(repository),
    getCurrentTaskRevision: async () => current,
    insertTaskRevision: async (value) => { calls.push(["revision", value]); return value; },
    updateTask: async (taskId, value) => { calls.push(["task", taskId, value]); return value; },
    appendResearchEvent: async (value) => { calls.push(["event", value]); return value; },
  };
  const result = await transitionTask({
    repository, actorId: "actor-1", actorRole: "maintainer", taskId: "task-1", toState: "open",
    ifMatch: 'W/"task-1:1:abc"', currentEtag: 'W/"task-1:1:abc"',
    eventFactory: async ({ eventType, payload }) => ({ eventId: "event-8", eventType, payload }),
  });
  assert.deepEqual(calls.map(([kind]) => kind), ["revision", "task", "event"]);
  assert.equal(result.revision.state, "open");
  assert.equal(result.revision.revision, 2);
  assert.equal(result.event.eventType, "task.state_changed");
  assert.equal(result.event.payload.from_state, "draft");
});

test("rejects an invalid task transition before writing", async () => {
  const calls = [];
  const repository = {
    withTransaction: (callback) => callback(repository),
    getCurrentTaskRevision: async () => ({ taskId: "task-1", revision: 1, state: "draft", title: "Title", description: "Description", inputs: [], outputs: [], acceptance: {}, contextMode: "blind" }),
    insertTaskRevision: async () => calls.push("revision"),
    updateTask: async () => calls.push("task"),
    appendResearchEvent: async () => calls.push("event"),
  };
  await assert.rejects(
    transitionTask({ repository, actorId: "actor-1", actorRole: "maintainer", taskId: "task-1", toState: "completed", ifMatch: 'W/"task-1:1:abc"', currentEtag: 'W/"task-1:1:abc"', eventFactory: () => ({}) }),
    (error) => error.code === "STATE_TRANSITION_INVALID" && error.status === 409,
  );
  assert.deepEqual(calls, []);
});
