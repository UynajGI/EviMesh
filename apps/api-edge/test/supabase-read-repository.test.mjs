import test from "node:test";
import assert from "node:assert/strict";
import { createSupabaseReadRepository, SupabaseReadRepositoryError } from "../src/supabase-read-repository.mjs";

const CONFIG = {
  url: "https://project.supabase.co",
  publishableKey: "sb_publishable_test",
};

test("reads public rows with the publishable key and maps database columns", async () => {
  const requests = [];
  const repository = createSupabaseReadRepository({
    ...CONFIG,
    fetchImpl: async (url, options) => {
      requests.push({ url: new URL(url), options });
      return Response.json([{ question_id: "question-1", project_id: "project-1", state: "active", created_at: "2026-08-08T00:00:00.000Z", deleted_at: null }]);
    },
  });

  const rows = await repository.listQuestions({ projectId: "project-1", state: "active" });

  assert.equal(requests[0].url.pathname, "/rest/v1/questions");
  assert.equal(requests[0].url.searchParams.get("project_id"), "eq.project-1");
  assert.equal(requests[0].url.searchParams.get("state"), "eq.active");
  assert.equal(requests[0].url.searchParams.get("deleted_at"), "is.null");
  assert.equal(requests[0].options.headers.apikey, CONFIG.publishableKey);
  assert.equal(requests[0].options.headers.authorization, undefined);
  assert.deepEqual(rows, [{ questionId: "question-1", projectId: "project-1", state: "active", createdAt: "2026-08-08T00:00:00.000Z", deletedAt: null }]);
});

test("backs task filters with question and current-revision metadata", async () => {
  const requests = [];
  const repository = createSupabaseReadRepository({
    ...CONFIG,
    fetchImpl: async (url) => {
      const request = new URL(url);
      requests.push(request);
      if (request.pathname.endsWith("/tasks")) return Response.json([{ task_id: "task-1", question_id: "question-1", state: "open", created_at: "2026-08-08T00:00:00.000Z", deleted_at: null }]);
      if (request.pathname.endsWith("/task_revisions")) return Response.json([
        { task_id: "task-1", revision: 1, task_type: "obsolete", tags: [], created_at: "2026-08-08T00:00:00.000Z" },
        { task_id: "task-1", revision: 2, task_type: "verification", tags: ["cpu-only"], created_at: "2026-08-08T01:00:00.000Z" },
      ]);
      if (request.pathname.endsWith("/questions")) return Response.json([{ question_id: "question-1", project_id: "project-1", deleted_at: null }]);
      return Response.json([]);
    },
  });

  const rows = await repository.listTasks({ tag: "cpu-only", type: "verification", projectId: "project-1" });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].projectId, "project-1");
  assert.equal(rows[0].type, "verification");
  assert.deepEqual(rows[0].tags, ["cpu-only"]);
  assert.equal(requests.find((url) => url.pathname.endsWith("/questions")).searchParams.get("project_id"), "eq.project-1");
});

test("supplies project detail and frontier read methods", async () => {
  const repository = createSupabaseReadRepository({
    ...CONFIG,
    fetchImpl: async (url) => {
      const request = new URL(url);
      if (request.pathname.endsWith("/projects")) return Response.json([{ project_id: "project-1", state: "active", deleted_at: null }]);
      if (request.pathname.endsWith("/project_revisions")) return Response.json([{ project_id: "project-1", revision: 2 }]);
      if (request.pathname.endsWith("/frontier_snapshots")) return Response.json([{ snapshot_id: "snapshot-1", project_id: "project-1", sequence: 1 }]);
      if (request.pathname.endsWith("/frontier_members")) return Response.json([{ snapshot_id: "snapshot-1", claim_id: "claim-1" }]);
      return Response.json([]);
    },
  });

  assert.equal((await repository.getProject("project-1")).projectId, "project-1");
  assert.equal((await repository.getCurrentProjectRevision("project-1")).revision, 2);
  assert.equal((await repository.listFrontierSnapshots({ projectId: "project-1" }))[0].snapshotId, "snapshot-1");
  assert.equal((await repository.listFrontierMembers("snapshot-1"))[0].claimId, "claim-1");
});

test("supplies linked task and claim detail methods", async () => {
  const repository = createSupabaseReadRepository({
    ...CONFIG,
    fetchImpl: async (url) => {
      const request = new URL(url);
      if (request.pathname.endsWith("/tasks")) return Response.json([{ task_id: "task-1", state: "open", deleted_at: null }]);
      if (request.pathname.endsWith("/task_revisions")) return Response.json([{ task_id: "task-1", revision: 2 }]);
      if (request.pathname.endsWith("/task_dependencies")) return Response.json([{ source_task_id: "task-1", target_task_id: "task-2", deleted_at: null }]);
      if (request.pathname.endsWith("/task_leases")) return Response.json([{ task_id: "task-1", holder_actor_id: "actor-1", deleted_at: null }]);
      if (request.pathname.endsWith("/claims")) return Response.json([{ claim_id: "claim-1", state: "candidate", deleted_at: null }]);
      if (request.pathname.endsWith("/claim_revisions")) return Response.json([{ claim_id: "claim-1", revision: 3 }]);
      return Response.json([]);
    },
  });

  assert.equal((await repository.getTask("task-1")).taskId, "task-1");
  assert.equal((await repository.getCurrentTaskRevision("task-1")).revision, 2);
  assert.equal((await repository.listTaskDependencies("task-1"))[0].targetTaskId, "task-2");
  assert.equal((await repository.listCurrentTaskLeases("task-1"))[0].holderActorId, "actor-1");
  assert.equal((await repository.getClaim("claim-1")).claimId, "claim-1");
  assert.equal((await repository.getCurrentClaimRevision("claim-1")).revision, 3);
});

test("continues Data API reads past the project row cap", async () => {
  const ranges = [];
  const repository = createSupabaseReadRepository({
    ...CONFIG,
    fetchImpl: async (_url, options) => {
      ranges.push(options.headers.range);
      return Response.json(ranges.length === 1
        ? Array.from({ length: 1_000 }, (_, index) => ({ project_id: `project-${index}`, state: "active", created_at: `2026-08-08T00:00:00.${String(index).padStart(3, "0")}Z`, deleted_at: null }))
        : [{ project_id: "project-1000", state: "active", created_at: "2026-08-08T00:00:01.000Z", deleted_at: null }]);
    },
  });

  assert.equal((await repository.listProjects()).length, 1_001);
  assert.deepEqual(ranges, ["0-999", "1000-1999"]);
});

test("targets each public identity table with supported state filters", async () => {
  const requests = [];
  const repository = createSupabaseReadRepository({
    ...CONFIG,
    fetchImpl: async (url) => {
      requests.push(new URL(url));
      return Response.json([]);
    },
  });

  await repository.listProjects({ state: "active" });
  await repository.listTasks({ status: "open" });
  await repository.listClaims({ status: "under_verification" });

  assert.deepEqual(requests.map((url) => url.pathname), [
    "/rest/v1/projects",
    "/rest/v1/tasks",
    "/rest/v1/task_revisions",
    "/rest/v1/questions",
    "/rest/v1/claims",
  ]);
  assert.equal(requests.find((url) => url.pathname.endsWith("/projects")).searchParams.get("state"), "eq.active");
  assert.equal(requests.find((url) => url.pathname.endsWith("/tasks")).searchParams.get("state"), "eq.open");
  assert.equal(requests.find((url) => url.pathname.endsWith("/claims")).searchParams.get("state"), "eq.under_verification");
});

test("does not expose upstream response bodies when the Data API fails", async () => {
  const repository = createSupabaseReadRepository({
    ...CONFIG,
    fetchImpl: async () => new Response("upstream details containing sb_publishable_test", { status: 403 }),
  });

  await assert.rejects(repository.listProjects(), (error) => {
    assert.equal(error instanceof SupabaseReadRepositoryError, true);
    assert.equal(error.status, 503);
    assert.equal(error.message.includes(CONFIG.publishableKey), false);
    return true;
  });
});

test("requires explicit Supabase configuration", () => {
  assert.throws(() => createSupabaseReadRepository({ url: "", publishableKey: "key" }), SupabaseReadRepositoryError);
  assert.throws(() => createSupabaseReadRepository({ url: CONFIG.url, publishableKey: "" }), SupabaseReadRepositoryError);
});
