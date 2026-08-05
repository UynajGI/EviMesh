import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.mjs";

test("returns a healthy JSON response", async () => {
  const response = await worker.fetch(new Request("https://api.example.test/health"), {
    EVIMESH_ENV: "test",
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    service: "evimesh-api-edge",
    status: "ok",
    environment: "test",
  });
});
test("returns 404 for unknown routes", async () => {
  const response = await worker.fetch(new Request("https://api.example.test/unknown"), {});

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "not_found" });
});
