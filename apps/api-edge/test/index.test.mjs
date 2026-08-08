import test from "node:test";
import assert from "node:assert/strict";
import worker, { createApp, createWorker } from "../src/index.mjs";

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

test("wires the hosted Supabase read repository from Worker environment bindings", async () => {
  const upstreamRequests = [];
  const hostedWorker = createWorker({
    fetchImpl: async (url, options) => {
      upstreamRequests.push({ url: new URL(url), options });
      return Response.json([{ question_id: "question-1", project_id: "project-1", state: "active", created_at: "2026-08-08T00:00:00.000Z", deleted_at: null }]);
    },
  });
  const response = await hostedWorker.fetch(new Request("https://api.example.test/questions?limit=20"), {
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  });

  assert.equal(response.status, 200);
  assert.equal(upstreamRequests.length, 1);
  assert.equal(upstreamRequests[0].url.pathname, "/rest/v1/questions");
  assert.equal(upstreamRequests[0].options.headers.apikey, "sb_publishable_test");
  assert.deepEqual((await response.json()).items.map((question) => question.questionId), ["question-1"]);
});

test("allows browser requests from a configured web origin", async () => {
  const response = await worker.fetch(new Request("https://api.example.test/health", {
    headers: { origin: "https://evimesh.com" },
  }), {
    EVIMESH_ENV: "production",
    CORS_ALLOWED_ORIGINS: "https://evimesh.com",
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://evimesh.com");
  assert.equal(response.headers.get("vary"), "Origin");
});

test("does not allow browser requests from an unconfigured origin", async () => {
  const response = await worker.fetch(new Request("https://api.example.test/health", {
    headers: { origin: "https://attacker.example" },
  }), {
    EVIMESH_ENV: "production",
    CORS_ALLOWED_ORIGINS: "https://evimesh.com",
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(response.headers.get("vary"), "Origin");
});

test("does not authorize CORS preflight requests from an unconfigured origin", async () => {
  const response = await worker.fetch(new Request("https://api.example.test/health", {
    method: "OPTIONS",
    headers: {
      origin: "https://attacker.example",
      "access-control-request-method": "GET",
    },
  }), {
    EVIMESH_ENV: "production",
    CORS_ALLOWED_ORIGINS: "https://evimesh.com",
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(response.headers.get("access-control-allow-credentials"), null);
  assert.equal(response.headers.get("vary"), "Origin");
});

test("answers CORS preflight requests for a configured web origin", async () => {
  const response = await worker.fetch(new Request("https://api.example.test/questions?limit=20", {
    method: "OPTIONS",
    headers: {
      origin: "https://evimesh.com",
      "access-control-request-method": "GET",
      "access-control-request-headers": "authorization,x-request-id",
    },
  }), {
    EVIMESH_ENV: "production",
    CORS_ALLOWED_ORIGINS: "https://evimesh.com",
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://evimesh.com");
  assert.match(response.headers.get("access-control-allow-methods"), /(?:^|,)GET(?:,|$)/);
  assert.equal(response.headers.get("access-control-allow-headers"), "authorization,x-request-id");
  assert.equal(response.headers.get("access-control-max-age"), "600");
  assert.match(response.headers.get("vary"), /Origin/);
  assert.match(response.headers.get("vary"), /Access-Control-Request-Headers/);
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

test('lists Frontier history with fixed Claim members', async () => {
  const app = createApp({ repository: {
    listFrontierSnapshots: async () => [{ snapshotId: 'frontier-1', projectId: 'project-1', sequence: 1, createdAt: '2026-08-06T00:00:00.000Z' }],
    listFrontierMembers: async () => [{ claimId: 'claim-1', claimRevision: 2, membershipType: 'core' }],
  } });
  const response = await app.fetch(new Request('https://api.example.test/projects/project-1/frontier/history?limit=6'), {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).items[0].members[0].claimId, 'claim-1');
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

test('returns a Claim with statement, scope, falsification, and status policy', async () => {
  const app = createApp({ repository: {
    getClaim: async (claimId) => ({ claimId, questionId: 'question-1', state: 'candidate' }),
    getCurrentClaimRevision: async () => ({ claimId: 'claim-1', revision: 2, supersedes: 1, statement: 'The evidence supports the hypothesis.', scope: { population: 'sample' }, falsification: ['failed reproduction'] }),
  } });
  const response = await app.fetch(new Request('https://api.example.test/claims/claim-1'), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.currentRevision.statement, 'The evidence supports the hypothesis.');
  assert.deepEqual(body.statusPolicy.allowedTransitions, ['under_verification', 'contested', 'refuted', 'superseded', 'retracted', 'dependency_tainted']);
});

test('returns bounded upstream and downstream Claim graphs', async () => {
  const app = createApp({ repository: {
    getClaimUpstreamGraph: async ({ claimId, maxDepth }) => [{ claimId: 'parent-1', root: claimId, maxDepth }],
    getClaimDownstreamGraph: async () => [{ claimId: 'child-1', state: 'dependency_tainted' }],
  } });
  const upstream = await app.fetch(new Request('https://api.example.test/claims/claim-1/graph?direction=upstream&maxDepth=2'), {});
  const downstream = await app.fetch(new Request('https://api.example.test/claims/claim-1/graph?direction=downstream'), {});
  assert.equal((await upstream.json()).nodes[0].claimId, 'parent-1');
  assert.equal((await downstream.json()).nodes[0].dependencyTainted, true);
});

test('returns an immutable Claim revision by revision number', async () => {
  const app = createApp({ repository: { getClaimRevision: async (claimId, revision) => ({ claimId, revision, statement: 'Historical statement.' }) } });
  const response = await app.fetch(new Request('https://api.example.test/claims/claim-1/revisions/1'), {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).claimRevision.revision, 1);
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

test('starts an Attempt from a matching Context Bundle', async () => {
  const app = createApp({
    repository: {
      findIdentity: async () => ({ actorId: 'actor-1' }),
      getContextBundle: async () => ({ contextBundleId: 'bundle-1', taskId: 'task-1', mode: 'frontier' }),
      insertAttempt: async () => null,
      appendResearchEvent: async () => null,
      withTransaction: async (callback) => callback({
        getContextBundle: async () => ({ contextBundleId: 'bundle-1', taskId: 'task-1', mode: 'frontier' }),
        insertAttempt: async (attempt) => attempt,
        appendResearchEvent: async (event) => event,
      }),
    },
    attemptEventFactory: async ({ eventType, payload }) => ({ eventType, payload }),
    attemptRoleResolver: async () => 'contributor',
    authenticate: async () => ({ sub: 'supabase-subject' }),
  });
  const response = await app.fetch(new Request('https://api.example.test/tasks/task-1/attempts', {
    method: 'POST',
    headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
    body: JSON.stringify({ attemptId: 'attempt-1', contextBundleId: 'bundle-1', contextMode: 'frontier' }),
  }), {});
  const body = await response.json();
  assert.equal(response.status, 201, JSON.stringify(body));
  assert.equal(body.attempt.state, 'active');
});

test('acquires and releases the authenticated Actor Task lease', async () => {
  const leases = [];
  const repository = {
    findIdentity: async () => ({ actorId: 'actor-1' }),
    listCurrentTaskLeases: async () => leases,
    insertTaskLease: async (lease) => { leases.push(lease); return lease; },
    updateTaskLease: async (taskId, actorId, patch) => {
      const lease = leases.find((candidate) => candidate.taskId === taskId && candidate.holderActorId === actorId);
      Object.assign(lease, patch);
      return lease;
    },
    appendResearchEvent: async (event) => event,
    withTransaction: async (callback) => callback(repository),
  };
  const app = createApp({ repository, leaseEventFactory: async ({ eventType, payload }) => ({ eventType, payload }), leaseRoleResolver: async () => 'maintainer', authenticate: async () => ({ sub: 'supabase-subject' }) });
  const acquire = await app.fetch(new Request('https://api.example.test/tasks/task-1/lease', { method: 'POST', headers: { authorization: 'Bearer test-token' }, body: '{}' }), {});
  assert.equal(acquire.status, 201);
  const release = await app.fetch(new Request('https://api.example.test/tasks/task-1/lease', { method: 'DELETE', headers: { authorization: 'Bearer test-token' } }), {});
  assert.equal(release.status, 200);
  assert.ok(leases[0].deletedAt);
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
