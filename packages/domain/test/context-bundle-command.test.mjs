import assert from "node:assert/strict";
import test from "node:test";
import { ContextBundleCommandError, createContextBundle } from "../src/context-bundle-command.mjs";

const bundle = { version: 1, mode: "frontier", task: { taskId: "task-1", revision: 2, title: "T", description: "D", inputs: [], outputs: {}, acceptance: {} }, frontier: { snapshotId: "frontier-1", members: [] }, dependencies: [] };
function repository() {
  const calls = [];
  const repo = {
    calls,
    withTransaction: async (callback) => callback(repo),
    getTaskRevision: async () => ({ taskId: "task-1", revision: 2 }),
    getFrontierSnapshot: async () => ({ snapshotId: "frontier-1" }),
    insertContextBundle: async (value) => { calls.push(["bundle", value]); return value; },
    appendResearchEvent: async (value) => { calls.push(["event", value]); return value; },
  };
  return repo;
}

test("ContextBundle command persists a derived hash and ResearchEvent atomically", async () => {
  const repo = repository();
  const result = await createContextBundle({ repository: repo, actorId: "actor-1", actorRole: "contributor", contextBundleId: "context-1", bundle, storageUri: "r2://evimesh-context/context-1.json", eventFactory: async (event) => event });
  assert.match(result.contextBundle.contentHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(result.contextBundle.manifest.mode, "frontier");
  assert.equal(result.event.eventType, "context_bundle.created");
  assert.equal(result.event.payload.content_hash, result.contextBundle.contentHash);
  assert.deepEqual(repo.calls.map(([type]) => type), ["bundle", "event"]);
});

test("ContextBundle command rejects missing immutable references before persistence", async () => {
  const repo = repository();
  repo.getFrontierSnapshot = async () => null;
  await assert.rejects(() => createContextBundle({ repository: repo, actorId: "actor-1", actorRole: "contributor", contextBundleId: "context-1", bundle, storageUri: "r2://evimesh-context/context-1.json", eventFactory: async (event) => event }), (error) => error instanceof ContextBundleCommandError && error.code === "FRONTIER_SNAPSHOT_NOT_FOUND");
  assert.deepEqual(repo.calls, []);
});

test("ContextBundle command rejects malformed storage and unsupported bundle mode", async () => {
  const input = { repository: repository(), actorId: "actor-1", actorRole: "contributor", contextBundleId: "context-1", bundle, storageUri: "r2://evimesh-context/context-1.json", eventFactory: async (event) => event };
  await assert.rejects(() => createContextBundle({ ...input, storageUri: "not a uri" }), ContextBundleCommandError);
  await assert.rejects(() => createContextBundle({ ...input, bundle: { ...bundle, mode: "unknown" } }), ContextBundleCommandError);
});
