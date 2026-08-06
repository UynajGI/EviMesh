import assert from "node:assert/strict";
import test from "node:test";
import { ContextQueryError, getTaskContext } from "../src/context-query.mjs";

const bundle = { contextBundleId: "context-1", taskId: "task-1", taskRevision: 2, frontierSnapshotId: "frontier-1", mode: "blind", contentHash: `sha256:${"a".repeat(64)}`, storageUri: "r2://evimesh-context/context-1.json", manifest: {} };

test("Task Context query returns the bundle for the requested mode", async () => {
  let received;
  const result = await getTaskContext({ repository: { getContextBundleForTask: async (query) => { received = query; return bundle; } }, taskId: " task-1 ", mode: "blind" });
  assert.deepEqual(received, { taskId: "task-1", mode: "blind" });
  assert.equal(result.contextBundleId, "context-1");
});

test("Task Context query rejects invalid modes and missing or mismatched bundles", async () => {
  await assert.rejects(() => getTaskContext({ repository: { getContextBundleForTask: async () => bundle }, taskId: "task-1", mode: "invalid" }), ContextQueryError);
  await assert.rejects(() => getTaskContext({ repository: { getContextBundleForTask: async () => null }, taskId: "task-1", mode: "frontier" }), (error) => error.code === "CONTEXT_BUNDLE_NOT_FOUND" && error.status === 404);
  await assert.rejects(() => getTaskContext({ repository: { getContextBundleForTask: async () => bundle }, taskId: "task-1", mode: "frontier" }), (error) => error.code === "CONTEXT_BUNDLE_MISMATCH" && error.status === 500);
});
