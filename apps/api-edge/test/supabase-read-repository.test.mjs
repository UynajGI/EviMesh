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

test("fails closed for filters that are not represented by identity rows", async () => {
  const repository = createSupabaseReadRepository({
    ...CONFIG,
    fetchImpl: async () => Response.json([{ task_id: "task-1", state: "open", created_at: "2026-08-08T00:00:00.000Z", deleted_at: null }]),
  });

  assert.deepEqual(await repository.listTasks({ tag: "cpu-only" }), []);
  assert.deepEqual(await repository.listTasks({ type: "verification" }), []);
  assert.deepEqual(await repository.listTasks({ projectId: "project-1" }), []);
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
    "/rest/v1/claims",
  ]);
  assert.deepEqual(requests.map((url) => url.searchParams.get("state")), [
    "eq.active",
    "eq.open",
    "eq.under_verification",
  ]);
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
