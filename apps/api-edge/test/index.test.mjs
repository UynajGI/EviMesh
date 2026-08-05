import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.mjs";

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
