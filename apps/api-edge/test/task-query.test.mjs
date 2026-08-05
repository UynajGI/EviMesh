import test from "node:test";
import assert from "node:assert/strict";
import { getTask, listTasks } from "../src/task-query.mjs";

const tasks = [
  { taskId: "task-2", projectId: "project-1", status: "open", createdAt: "2026-08-02T00:00:00.000Z" },
  { taskId: "task-1", projectId: "project-1", status: "draft", createdAt: "2026-08-01T00:00:00.000Z" },
];

test("lists tasks with project/status/type/tag filters and stable pagination", async () => {
  let received;
  const first = await listTasks({
    repository: { listTasks: async (filters) => { received = filters; return tasks; } },
    projectId: "project-1",
    status: "open",
    type: "verification",
    tag: "cpu-only",
    limit: 1,
  });
  assert.deepEqual(received, { projectId: "project-1", status: "open", type: "verification", tag: "cpu-only" });
  assert.deepEqual(first.items.map(({ taskId }) => taskId), ["task-1"]);
  assert.ok(first.nextCursor);
});

test("returns task detail with dependencies and current leases", async () => {
  const result = await getTask({
    repository: {
      getTask: async (taskId) => ({ taskId, state: "open" }),
      getCurrentTaskRevision: async () => ({ taskId: "task-1", revision: 1, title: "Verify" }),
      listTaskDependencies: async () => [{ sourceTaskId: "task-1", targetTaskId: "task-0" }],
      listCurrentTaskLeases: async () => [{ holderActorId: "actor-1", expiresAt: "2026-08-06T00:00:00.000Z" }],
    },
    taskId: "task-1",
  });
  assert.equal(result.currentRevision.revision, 1);
  assert.equal(result.dependencies[0].targetTaskId, "task-0");
  assert.equal(result.leases[0].holderActorId, "actor-1");
});

test("returns a typed not-found error for an unknown task", async () => {
  await assert.rejects(
    getTask({ repository: { getTask: async () => null, getCurrentTaskRevision: async () => null, listTaskDependencies: async () => [], listCurrentTaskLeases: async () => [] }, taskId: "missing" }),
    (error) => error.code === "TASK_NOT_FOUND" && error.status === 404,
  );
});
