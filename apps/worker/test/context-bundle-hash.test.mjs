import assert from "node:assert/strict";
import test from "node:test";
import { ContextBundleHashError, canonicalContextBundleJson, hashContextBundle, verifyContextBundleHash } from "../src/context-bundle-hash.mjs";

const bundle = {
  version: 1, mode: "frontier", task: { taskId: "task-1", revision: 2, inputs: [{ artifact: "a" }] },
  frontier: { snapshotId: "frontier-1", members: [{ claimId: "claim-1", revision: 1 }] }, dependencies: [],
};

test("ContextBundle hash is canonical across object key order", () => {
  const reordered = {
    dependencies: [], frontier: { members: [{ revision: 1, claimId: "claim-1" }], snapshotId: "frontier-1" },
    task: { inputs: [{ artifact: "a" }], revision: 2, taskId: "task-1" }, mode: "frontier", version: 1,
  };
  assert.equal(canonicalContextBundleJson(bundle), canonicalContextBundleJson(reordered));
  assert.equal(hashContextBundle(bundle), hashContextBundle(reordered));
  assert.match(hashContextBundle(bundle), /^sha256:[0-9a-f]{64}$/);
});

test("ContextBundle hash verification detects tampered downloaded content", () => {
  const contentHash = hashContextBundle(bundle);
  assert.deepEqual(verifyContextBundleHash({ bundle, expectedHash: contentHash }), { verified: true, contentHash });
  assert.throws(() => verifyContextBundleHash({ bundle: { ...bundle, mode: "blind" }, expectedHash: contentHash }), (error) => error instanceof ContextBundleHashError && error.code === "CONTEXT_BUNDLE_HASH_MISMATCH");
});

test("ContextBundle hash rejects non-canonicalizable bundles and invalid expected hashes", () => {
  assert.throws(() => hashContextBundle({ ...bundle, value: undefined }), ContextBundleHashError);
  assert.throws(() => verifyContextBundleHash({ bundle, expectedHash: "sha256:ABC" }), ContextBundleHashError);
});
