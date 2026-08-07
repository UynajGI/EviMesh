import test from "node:test";
import assert from "node:assert/strict";
import { createEviMeshClient } from "../src/client.mjs";
import {
  EviMeshApiError,
  EviMeshAuthenticationError,
  EviMeshConflictError,
  EviMeshForbiddenError,
  EviMeshNotFoundError,
  EviMeshPreconditionError,
  EviMeshUnavailableError,
  EviMeshValidationError,
} from "../src/errors.mjs";
import { generateIdempotencyKey } from "../src/idempotency.mjs";
import { collectItems, iterateItems } from "../src/pagination.mjs";

function recordingFetch(handler) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return handler(url, options);
  };
  return { calls, fetchImpl };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name === "content-type" ? "application/json" : null) },
    text: async () => JSON.stringify(body),
  };
}

test("rejects a missing or relative base url", () => {
  assert.throws(() => createEviMeshClient({}), /baseUrl is required/);
  assert.throws(() => createEviMeshClient({ baseUrl: "/relative" }), /absolute URL/);
});

test("rejects both a static token and a token provider", () => {
  assert.throws(() => createEviMeshClient({ baseUrl: "https://api.example.test", token: "a", tokenProvider: async () => "b" }), /not both/);
});

test("sends the bearer token and JSON content type on writes", async () => {
  const { calls, fetchImpl } = recordingFetch(() => jsonResponse(200, { ok: true }));
  const client = createEviMeshClient({ baseUrl: "https://api.example.test/", token: "api-token", fetchImpl });
  await client.request("POST", "/projects", { body: { projectId: "project-1" } });
  assert.equal(calls[0].url, "https://api.example.test/projects");
  assert.equal(calls[0].options.headers.authorization, "Bearer api-token");
  assert.equal(calls[0].options.headers["content-type"], "application/json");
  assert.equal(calls[0].options.body, JSON.stringify({ projectId: "project-1" }));
});

test("resolves tokens lazily through a provider supporting Supabase sessions", async () => {
  let fetched = 0;
  const { calls, fetchImpl } = recordingFetch(() => jsonResponse(200, { ok: true }));
  const client = createEviMeshClient({
    baseUrl: "https://api.example.test",
    tokenProvider: async () => { fetched += 1; return "jwt-token"; },
    fetchImpl,
  });
  await client.request("GET", "/health");
  await client.request("GET", "/health");
  assert.equal(fetched, 2);
  assert.equal(calls[0].options.headers.authorization, "Bearer jwt-token");
});

test("adds an idempotency key to writes by default and honors overrides", async () => {
  const { calls, fetchImpl } = recordingFetch(() => jsonResponse(201, { ok: true }));
  const client = createEviMeshClient({ baseUrl: "https://api.example.test", fetchImpl });
  await client.request("POST", "/claims", { body: {} });
  await client.request("POST", "/claims", { body: {}, idempotencyKey: "fixed-key" });
  await client.request("POST", "/claims", { body: {}, idempotencyKey: false });
  await client.request("GET", "/claims");
  assert.match(calls[0].options.headers["idempotency-key"], /[0-9a-f-]{36}/);
  assert.equal(calls[1].options.headers["idempotency-key"], "fixed-key");
  assert.equal(calls[2].options.headers["idempotency-key"], undefined);
  assert.equal(calls[3].options.headers["idempotency-key"], undefined);
});

test("supports a custom idempotency key generator", async () => {
  const { calls, fetchImpl } = recordingFetch(() => jsonResponse(201, {}));
  const client = createEviMeshClient({ baseUrl: "https://api.example.test", fetchImpl, idempotencyKeyGenerator: () => "generated-1" });
  await client.request("POST", "/runs", { body: {} });
  assert.equal(calls[0].options.headers["idempotency-key"], "generated-1");
});

test("encodes query parameters and skips null values", async () => {
  const { calls, fetchImpl } = recordingFetch(() => jsonResponse(200, { items: [] }));
  const client = createEviMeshClient({ baseUrl: "https://api.example.test", fetchImpl });
  await client.request("GET", "/tasks", { query: { status: "open", tag: null, limit: 5 } });
  assert.equal(calls[0].url, "https://api.example.test/tasks?status=open&limit=5");
});

test("maps API error bodies to typed exceptions", async () => {
  const cases = [
    [400, EviMeshValidationError, "invalid_input"],
    [401, EviMeshAuthenticationError, "unauthorized"],
    [403, EviMeshForbiddenError, "PROJECT_FORBIDDEN"],
    [404, EviMeshNotFoundError, "CLAIM_NOT_FOUND"],
    [409, EviMeshConflictError, "STATE_TRANSITION_INVALID"],
    [412, EviMeshPreconditionError, "PRECONDITION_FAILED"],
    [503, EviMeshUnavailableError, "UPLOAD_UNAVAILABLE"],
    [500, EviMeshApiError, "internal_error"],
  ];
  for (const [status, ErrorClass, code] of cases) {
    const { fetchImpl } = recordingFetch(() => jsonResponse(status, { code, message: "failed", request_id: "req-1" }));
    const client = createEviMeshClient({ baseUrl: "https://api.example.test", fetchImpl });
    await assert.rejects(client.request("GET", "/claims/claim-1"), (error) => {
      assert.ok(error instanceof ErrorClass, `status ${status} should map to ${ErrorClass.name}`);
      assert.equal(error.code, code);
      assert.equal(error.status, status);
      assert.equal(error.requestId, "req-1");
      return true;
    });
  }
});

test("paginates through cursor pages without duplicates", async () => {
  const pages = new Map([
    ["null", { items: [{ id: 1 }, { id: 2 }], nextCursor: "cursor-a" }],
    ["cursor-a", { items: [{ id: 3 }], nextCursor: null }],
  ]);
  const fetchImpl = async (url) => {
    const cursor = new URL(url).searchParams.get("cursor") ?? "null";
    return jsonResponse(200, pages.get(cursor));
  };
  const client = createEviMeshClient({ baseUrl: "https://api.example.test", fetchImpl });
  const items = [];
  for await (const item of client.paginate("/projects", { limit: 2 })) items.push(item);
  assert.deepEqual(items.map((item) => item.id), [1, 2, 3]);
});

test("iterateItems and collectItems walk fetchPage callbacks", async () => {
  const pages = [
    { items: ["a", "b"], nextCursor: "next" },
    { items: ["c"], nextCursor: null },
  ];
  let call = 0;
  const fetchPage = async () => pages[call++];
  const streamed = [];
  for await (const item of iterateItems(fetchPage)) streamed.push(item);
  assert.deepEqual(streamed, ["a", "b", "c"]);
  call = 0;
  assert.deepEqual(await collectItems(fetchPage), ["a", "b", "c"]);
});

test("generateIdempotencyKey rejects empty generator output", () => {
  assert.throws(() => generateIdempotencyKey(() => "  "), /non-empty/);
  assert.equal(typeof generateIdempotencyKey(), "string");
});
