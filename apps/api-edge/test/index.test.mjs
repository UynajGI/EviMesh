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

test('creates a project through the authenticated command boundary', async () => {
  const calls = [];
  const app = createApp({
    repository: {
      findIdentity: async () => ({ actorId: 'actor-1' }),
      insertProject: async () => null,
      insertProjectRevision: async () => null,
      insertProjectMember: async () => null,
      appendResearchEvent: async () => null,
      withTransaction: async (callback) => callback({
        insertProject: async (project) => { calls.push(['project', project]); return project; },
        insertProjectRevision: async (revision) => { calls.push(['revision', revision]); return revision; },
        insertProjectMember: async (member) => { calls.push(['member', member]); return member; },
        appendResearchEvent: async (event) => { calls.push(['event', event]); return event; },
      }),
    },
    projectEventFactory: async ({ eventType, payload }) => ({ eventType, payload }),
    authenticate: async () => ({ sub: 'supabase-subject' }),
  });
  const response = await app.fetch(new Request('https://api.example.test/projects', {
    method: 'POST',
    headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
    body: JSON.stringify({ projectId: 'project-1', name: 'Evidence Mesh', summary: 'A research project.', license: 'CC-BY-4.0' }),
  }), { SUPABASE_JWT_SECRET: 'test-secret' });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).project.projectId, 'project-1');
  assert.equal(calls.length, 4);
});

test('creates a question through the authenticated command boundary', async () => {
  const calls = [];
  const app = createApp({
    repository: {
      findIdentity: async () => ({ actorId: 'actor-1' }),
      insertQuestion: async () => null,
      insertQuestionRevision: async () => null,
      appendResearchEvent: async () => null,
      withTransaction: async (callback) => callback({
        insertQuestion: async (question) => { calls.push(['question', question]); return question; },
        insertQuestionRevision: async (revision) => { calls.push(['revision', revision]); return revision; },
        appendResearchEvent: async (event) => { calls.push(['event', event]); return event; },
      }),
    },
    questionEventFactory: async ({ eventType, payload }) => ({ eventType, payload }),
    questionRoleResolver: async () => 'maintainer',
    authenticate: async () => ({ sub: 'supabase-subject' }),
  });
  const response = await app.fetch(new Request('https://api.example.test/questions', {
    method: 'POST',
    headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
    body: JSON.stringify({ questionId: 'question-1', projectId: 'project-1', title: 'Evidence question', statement: 'What should we test?', researchContract: { contractId: 'contract-1', revision: 1 } }),
  }), {});
  assert.equal(response.status, 201);
  assert.equal((await response.json()).question.questionId, 'question-1');
  assert.equal(calls.length, 3);
});

test('lists open newcomer tasks by tag', async () => {
  const app = createApp({ repository: { listTasks: async ({ status, tag }) => [
    { taskId: 'task-1', projectId: 'project-1', status, tag, createdAt: '2026-08-06T00:00:00.000Z' },
  ] } });
  const response = await app.fetch(new Request('https://api.example.test/tasks?status=open&tag=cpu-only&limit=6'), {});
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).items.map((task) => task.tag), ['cpu-only']);
});

test('returns Task details with its current revision, dependencies, and leases', async () => {
  const app = createApp({ repository: {
    getTask: async (taskId) => ({ taskId, state: 'active' }),
    getCurrentTaskRevision: async (taskId) => ({ taskId, revision: 2, state: 'active', title: 'Verify evidence', description: 'Check the claim.', inputs: [], outputs: {}, acceptance: [], contextMode: 'adversarial' }),
    listTaskDependencies: async () => [{ sourceTaskId: 'task-1', targetTaskId: 'task-2', dependencyType: 'depends_on' }],
    listCurrentTaskLeases: async () => [{ taskId: 'task-1', holderActorId: 'actor-1' }],
  } });
  const response = await app.fetch(new Request('https://api.example.test/tasks/task-1'), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.currentRevision.contextMode, 'adversarial');
  assert.equal(body.dependencies.length, 1);
  assert.equal(body.leases.length, 1);
});

test('returns a Question with its Contract revision', async () => {
  const app = createApp({ repository: {
    getQuestion: async (questionId) => ({ questionId, projectId: 'project-1', state: 'draft' }),
    getCurrentQuestionRevision: async () => ({ questionId: 'question-1', revision: 1, title: 'Evidence question', statement: 'What should we test?', researchContract: { contractId: 'contract-1', revision: 1 } }),
    getResearchContractRevision: async () => ({ contractId: 'contract-1', revision: 1, title: 'Research contract' }),
  } });
  const response = await app.fetch(new Request('https://api.example.test/questions/question-1'), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.question.state, 'draft');
  assert.equal(body.contract.title, 'Research contract');
});

test("serves Task Context by explicit mode", async () => {
  const app = createApp({ repository: { getContextBundleForTask: async () => ({ contextBundleId: "context-1", taskId: "task-1", mode: "blind", contentHash: `sha256:${"a".repeat(64)}`, storageUri: "r2://evimesh/context-1.json", manifest: {} }) } });
  const response = await app.fetch(new Request("https://api.example.test/tasks/task-1/context?mode=blind", { headers: { "x-request-id": "context-request" } }), {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).contextBundleId, "context-1");
});
