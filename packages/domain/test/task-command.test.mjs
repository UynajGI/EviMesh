import test from "node:test";
import assert from "node:assert/strict";
import { acquireTaskLease, addTaskDependency, createTask, expireTaskLeases, renewTaskLease, reviseTask, transitionTask } from "../src/task-command.mjs";

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

test("adds an acyclic task dependency and records an event", async () => {
  const calls = [];
  const repository = {
    withTransaction: (callback) => callback(repository),
    listTaskDependencies: async () => [{ sourceTaskId: "task-1", targetTaskId: "task-2", dependencyType: "depends_on" }],
    insertTaskDependency: async (value) => { calls.push(["dependency", value]); return value; },
    appendResearchEvent: async (value) => { calls.push(["event", value]); return value; },
  };
  const result = await addTaskDependency({
    repository, actorId: "actor-1", actorRole: "maintainer", sourceTaskId: "task-2", targetTaskId: "task-3",
    eventFactory: async ({ eventType, payload }) => ({ eventId: "event-9", eventType, payload }),
  });
  assert.deepEqual(calls.map(([kind]) => kind), ["dependency", "event"]);
  assert.deepEqual(result.dependency, { sourceTaskId: "task-2", targetTaskId: "task-3", dependencyType: "depends_on", createdBy: "actor-1" });
  assert.equal(result.event.eventType, "task.dependency_created");
});

test("rejects self and cyclic task dependencies before writing", async () => {
  const calls = [];
  const repository = {
    withTransaction: (callback) => callback(repository),
    listTaskDependencies: async () => [{ sourceTaskId: "task-1", targetTaskId: "task-2" }, { sourceTaskId: "task-2", targetTaskId: "task-3" }],
    insertTaskDependency: async () => calls.push("dependency"),
    appendResearchEvent: async () => calls.push("event"),
  };
  for (const [sourceTaskId, targetTaskId] of [["task-1", "task-1"], ["task-3", "task-1"]]) {
    await assert.rejects(
      addTaskDependency({ repository, actorId: "actor-1", actorRole: "maintainer", sourceTaskId, targetTaskId, eventFactory: () => ({}) }),
      (error) => error.code === "DEPENDENCY_CYCLE" && error.status === 409,
    );
  }
  assert.deepEqual(calls, []);
});

test("rejects duplicate task dependencies before writing", async () => {
  const calls = [];
  const repository = {
    withTransaction: (callback) => callback(repository),
    listTaskDependencies: async () => [{ sourceTaskId: "task-1", targetTaskId: "task-2", dependencyType: "depends_on" }],
    insertTaskDependency: async () => calls.push("dependency"),
    appendResearchEvent: async () => calls.push("event"),
  };
  await assert.rejects(
    addTaskDependency({ repository, actorId: "actor-1", actorRole: "maintainer", sourceTaskId: "task-1", targetTaskId: "task-2", eventFactory: () => ({}) }),
    (error) => error.code === "DEPENDENCY_EXISTS" && error.status === 409,
  );
  assert.deepEqual(calls, []);
});

test("acquires an exclusive task lease with an expiry and event", async () => {
  const calls = [];
  const repository = {
    withTransaction: (callback) => callback(repository),
    listCurrentTaskLeases: async () => [],
    insertTaskLease: async (value) => { calls.push(["lease", value]); return value; },
    appendResearchEvent: async (value) => { calls.push(["event", value]); return value; },
  };
  const result = await acquireTaskLease({
    repository, actorId: "actor-1", actorRole: "maintainer", taskId: "task-1", leaseDurationMs: 30_000,
    now: "2026-08-06T00:00:00.000Z",
    eventFactory: async ({ eventType, payload }) => ({ eventId: "event-10", eventType, payload }),
  });
  assert.deepEqual(calls.map(([kind]) => kind), ["lease", "event"]);
  assert.equal(result.lease.acquiredAt, "2026-08-06T00:00:00.000Z");
  assert.equal(result.lease.expiresAt, "2026-08-06T00:00:30.000Z");
  assert.equal(result.event.eventType, "task.lease_acquired");
});

test("rejects an active lease held by another actor before writing", async () => {
  const calls = [];
  const repository = {
    withTransaction: (callback) => callback(repository),
    listCurrentTaskLeases: async () => [{ taskId: "task-1", holderActorId: "actor-2", expiresAt: "2026-08-06T00:01:00.000Z" }],
    insertTaskLease: async () => calls.push("lease"),
    appendResearchEvent: async () => calls.push("event"),
  };
  await assert.rejects(
    acquireTaskLease({ repository, actorId: "actor-1", actorRole: "maintainer", taskId: "task-1", now: "2026-08-06T00:00:00.000Z", eventFactory: () => ({}) }),
    (error) => error.code === "LEASE_CONFLICT" && error.status === 409,
  );
  assert.deepEqual(calls, []);
});

test("renews an active lease owned by the actor", async () => {
  const calls = [];
  const repository = {
    withTransaction: (callback) => callback(repository),
    listCurrentTaskLeases: async () => [{ taskId: "task-1", holderActorId: "actor-1", expiresAt: "2026-08-06T00:01:00.000Z", lastRenewedAt: null }],
    updateTaskLease: async (taskId, holderActorId, value) => { calls.push([taskId, holderActorId, value]); return { taskId, holderActorId, ...value }; },
    appendResearchEvent: async (value) => { calls.push(["event", value]); return value; },
  };
  const result = await renewTaskLease({
    repository, actorId: "actor-1", actorRole: "maintainer", taskId: "task-1", extensionMs: 30_000,
    now: "2026-08-06T00:00:30.000Z",
    eventFactory: async ({ eventType, payload }) => ({ eventId: "event-11", eventType, payload }),
  });
  assert.equal(calls[0][2].expiresAt, "2026-08-06T00:01:30.000Z");
  assert.equal(result.lease.lastRenewedAt, "2026-08-06T00:00:30.000Z");
  assert.equal(result.event.eventType, "task.lease_renewed");
});

test("rejects renewing an expired lease before writing", async () => {
  const calls = [];
  const repository = {
    withTransaction: (callback) => callback(repository),
    listCurrentTaskLeases: async () => [{ taskId: "task-1", holderActorId: "actor-1", expiresAt: "2026-08-06T00:00:30.000Z" }],
    updateTaskLease: async () => calls.push("lease"),
    appendResearchEvent: async () => calls.push("event"),
  };
  await assert.rejects(
    renewTaskLease({ repository, actorId: "actor-1", actorRole: "maintainer", taskId: "task-1", now: "2026-08-06T00:01:00.000Z", eventFactory: () => ({}) }),
    (error) => error.code === "LEASE_EXPIRED" && error.status === 409,
  );
  assert.deepEqual(calls, []);
});

test("expires due task leases and records cleanup events", async () => {
  const calls = [];
  const repository = {
    withTransaction: (callback) => callback(repository),
    listCurrentTaskLeases: async () => [
      { taskId: "task-1", holderActorId: "actor-1", expiresAt: "2026-08-06T00:00:30.000Z" },
      { taskId: "task-2", holderActorId: "actor-2", expiresAt: "2026-08-06T00:02:00.000Z" },
    ],
    updateTaskLease: async (taskId, holderActorId, value) => { calls.push(["lease", taskId, holderActorId, value]); return { taskId, holderActorId, ...value }; },
    appendResearchEvent: async (value) => { calls.push(["event", value]); return value; },
  };
  const result = await expireTaskLeases({
    repository, actorId: "actor-system", actorRole: "maintainer", now: "2026-08-06T00:01:00.000Z",
    eventFactory: async ({ eventType, payload }) => ({ eventId: "event-12", eventType, payload }),
  });
  assert.equal(result.length, 1);
  assert.deepEqual(calls.map(([kind]) => kind), ["lease", "event"]);
  assert.equal(result[0].lease.deletedAt, "2026-08-06T00:01:00.000Z");
  assert.equal(result[0].event.eventType, "task.lease_expired");
});
