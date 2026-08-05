import test from "node:test";
import assert from "node:assert/strict";
import { assertIfMatch, PreconditionFailedError, revisionEtag } from "../src/etag.mjs";
import { createIdempotencyMiddleware, executeIdempotently } from "../src/idempotency.mjs";
import { Hono } from "hono";
import { paginate } from "../src/pagination.mjs";

test("paginates with a stable cursor and no duplicates", () => {
  const rows = [{ id: "b", createdAt: "2026-01-01" }, { id: "a", createdAt: "2026-01-01" }, { id: "c", createdAt: "2026-01-02" }];
  const first = paginate(rows, { limit: 2 });
  const second = paginate(rows, { limit: 2, cursor: first.nextCursor });
  assert.deepEqual(first.items.map((row) => row.id), ["a", "b"]);
  assert.deepEqual(second.items.map((row) => row.id), ["c"]);
  assert.equal(second.nextCursor, null);
});

test("enforces revision ETags with 412 semantics", () => {
  const etag = revisionEtag({ objectId: "project_1", revision: 2, contentHash: "abc" });
  assert.equal(assertIfMatch(etag, etag), true);
  assert.throws(() => assertIfMatch('W/"stale"', etag), (error) => error instanceof PreconditionFailedError && error.status === 412);
});

test("replays the same idempotent result and rejects payload reuse", async () => {
  const records = new Map();
  const store = { get: async (key) => records.get(key) ?? null, put: async (key, value) => records.set(key, value) };
  let calls = 0;
  const execute = async () => { calls += 1; return { status: 201, body: { id: "project_1" } }; };
  const first = await executeIdempotently({ store, key: "request-1", payload: '{"name":"A"}', execute });
  const replay = await executeIdempotently({ store, key: "request-1", payload: '{"name":"A"}', execute });
  const conflict = await executeIdempotently({ store, key: "request-1", payload: '{"name":"B"}', execute });
  assert.equal(first.replayed, false);
  assert.equal(calls, 1);
  assert.equal(replay.replayed, true);
  assert.equal(conflict.conflict, true);
});

test("idempotency middleware replays the original HTTP response", async () => {
  const records = new Map();
  let executions = 0;
  const app = new Hono();
  app.use("/write", createIdempotencyMiddleware({
    store: {
      get: (key) => records.get(key),
      put: (key, value) => records.set(key, value),
    },
  }));
  app.post("/write", async (context) => {
    executions += 1;
    return context.json({ execution: executions, body: await context.req.text() }, 201);
  });

  const request = (body) => app.request("http://api.example.test/write", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "write-1" },
    body,
  });
  const first = await request('{"value":1}');
  const replay = await request('{"value":1}');
  const conflict = await request('{"value":2}');

  assert.equal(first.status, 201);
  assert.deepEqual(await replay.json(), await first.clone().json());
  assert.equal(conflict.status, 409);
  assert.equal(executions, 1);
});
