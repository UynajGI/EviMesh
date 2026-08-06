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

test("serves Task Context by explicit mode", async () => {
  const app = createApp({ repository: { getContextBundleForTask: async () => ({ contextBundleId: "context-1", taskId: "task-1", mode: "blind", contentHash: `sha256:${"a".repeat(64)}`, storageUri: "r2://evimesh/context-1.json", manifest: {} }) } });
  const response = await app.fetch(new Request("https://api.example.test/tasks/task-1/context?mode=blind", { headers: { "x-request-id": "context-request" } }), {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).contextBundleId, "context-1");
});
