import test from "node:test";
import assert from "node:assert/strict";
import worker, { createApp } from "../src/index.mjs";

test("returns a healthy JSON response", async () => {
  const response = await worker.fetch(new Request("https://api.example.test/health"), {
    EVIMESH_ENV: "test",
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("x-request-id"), /^[0-9a-f-]{36}$/);
  assert.deepEqual(await response.json(), {
    service: "evimesh-api-edge",
    status: "ok",
    environment: "test",
  });
});

test("writes structured request logs without authorization data", async () => {
  const originalLog = console.log;
  const lines = [];
  console.log = (line) => lines.push(line);
  try {
    await worker.fetch(new Request("https://api.example.test/health", {
      headers: { authorization: "Bearer secret-token" },
    }), { EVIMESH_ENV: "test" });
  } finally {
    console.log = originalLog;
  }
  const entry = JSON.parse(lines.at(-1));
  assert.deepEqual(Object.keys(entry).sort(), ["duration_ms", "event", "method", "path", "request_id", "status"]);
  assert.equal(entry.event, "api.request");
  assert.equal(lines.join("\n").includes("secret-token"), false);
});

test("preserves a valid request ID", async () => {
  const response = await worker.fetch(new Request("https://api.example.test/health", {
    headers: { "x-request-id": "test-request-1" },
  }), {});

  assert.equal(response.headers.get("x-request-id"), "test-request-1");
});

test("returns 404 for unknown routes", async () => {
  const response = await worker.fetch(new Request("https://api.example.test/unknown", {
    headers: { "x-request-id": "unknown-route" },
  }), {});

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    code: "not_found",
    message: "route not found",
    request_id: "unknown-route",
  });
  assert.equal(response.headers.get("x-request-id"), "unknown-route");
});

test('lists public questions with query filters', async () => {
  const app = createApp({ repository: { listQuestions: async ({ state }) => [
    { questionId: 'question-1', projectId: 'project-1', state: state ?? 'active', createdAt: '2026-08-06T00:00:00.000Z' },
  ] } });
  const response = await app.fetch(new Request('https://api.example.test/questions?state=active&limit=6'), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.items.map((question) => question.questionId), ['question-1']);
});

test('lists public claims with a status filter', async () => {
  const app = createApp({ repository: { listClaims: async ({ status }) => [
    { claimId: 'claim-1', questionId: 'question-1', state: status, createdAt: '2026-08-06T00:00:00.000Z' },
  ] } });
  const response = await app.fetch(new Request('https://api.example.test/claims?status=under_verification&limit=6'), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.items.map((claim) => claim.state), ['under_verification']);
});

test('lists projects and returns each latest frontier', async () => {
  const app = createApp({ repository: {
    listProjects: async () => [{ projectId: 'project-1', state: 'active', createdAt: '2026-08-06T00:00:00.000Z' }],
    listFrontierSnapshots: async () => [{ snapshotId: 'frontier-1', projectId: 'project-1', sequence: 3, createdAt: '2026-08-06T00:00:00.000Z' }],
  } });
  const projects = await app.fetch(new Request('https://api.example.test/projects?limit=6'), {});
  assert.equal(projects.status, 200);
  assert.deepEqual((await projects.json()).items.map((project) => project.projectId), ['project-1']);
  const frontier = await app.fetch(new Request('https://api.example.test/projects/project-1/frontier/latest'), {});
  assert.equal(frontier.status, 200);
  assert.equal((await frontier.json()).frontier.sequence, 3);
});

test('returns a public project with its current revision', async () => {
  const app = createApp({ repository: {
    getProject: async (projectId) => ({ projectId, state: 'active' }),
    getCurrentProjectRevision: async (projectId) => ({ projectId, revision: 2, name: 'Evidence Mesh', summary: 'A research project.' }),
  } });
  const response = await app.fetch(new Request('https://api.example.test/projects/project-1'), {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).currentRevision.name, 'Evidence Mesh');
});

test('lists open newcomer tasks by tag', async () => {
  const app = createApp({ repository: { listTasks: async ({ status, tag }) => [
    { taskId: 'task-1', projectId: 'project-1', status, tag, createdAt: '2026-08-06T00:00:00.000Z' },
  ] } });
  const response = await app.fetch(new Request('https://api.example.test/tasks?status=open&tag=cpu-only&limit=6'), {});
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).items.map((task) => task.tag), ['cpu-only']);
});

test("serves Task Context by explicit mode", async () => {
  const app = createApp({ repository: { getContextBundleForTask: async () => ({ contextBundleId: "context-1", taskId: "task-1", mode: "blind", contentHash: `sha256:${"a".repeat(64)}`, storageUri: "r2://evimesh/context-1.json", manifest: {} }) } });
  const response = await app.fetch(new Request("https://api.example.test/tasks/task-1/context?mode=blind", { headers: { "x-request-id": "context-request" } }), {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).contextBundleId, "context-1");
});
