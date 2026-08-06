import assert from "node:assert/strict";
import test from "node:test";
import { FrontierContextCompileError } from "../src/frontier-context-compiler.mjs";
import { compileBlindContext } from "../src/blind-context-compiler.mjs";

const taskRevision = {
  taskId: "task-1", revision: 2, title: "Blind task", description: "Do independent work.",
  inputs: [{ artifact: "input-1", targetLabel: "golden-answer" }],
  outputs: { result: "expected-answer" },
  acceptance: { targetLabel: "golden-answer", tests: ["unit"] },
};
const snapshot = { snapshotId: "frontier-7", projectId: "project-1", sequence: 7, projectRevision: 3, checkpoint: { root: "abc" } };
const member = {
  snapshotId: "frontier-7", claimId: "claim-a", claimRevision: 2, membershipType: "supporting",
  claimRevisionData: { claimId: "claim-a", revision: 2, state: "accepted", statement: "Pinned claim", scope: {}, assumptions: [], falsification: {} },
};

test("Blind compiler removes expected outputs and explicit target-label paths", () => {
  const bundle = compileBlindContext({
    taskRevision, frontierSnapshot: snapshot, frontierMembers: [member],
    hiddenPaths: ["/task/inputs/0/targetLabel", "/task/acceptance/targetLabel"],
  });
  assert.equal(bundle.mode, "blind");
  assert.equal(Object.hasOwn(bundle.task, "outputs"), false);
  assert.equal(Object.hasOwn(bundle.task.inputs[0], "targetLabel"), false);
  assert.equal(Object.hasOwn(bundle.task.acceptance, "targetLabel"), false);
  assert.equal(JSON.stringify(bundle).includes("expected-answer"), false);
  assert.equal(JSON.stringify(bundle).includes("golden-answer"), false);
});

test("Blind compiler fails closed for missing or malformed target paths", () => {
  const context = { taskRevision, frontierSnapshot: snapshot, frontierMembers: [member] };
  assert.throws(() => compileBlindContext({ ...context, hiddenPaths: ["/task/acceptance/missing"] }), (error) => error instanceof FrontierContextCompileError && error.code === "BLIND_PATH_NOT_FOUND");
  assert.throws(() => compileBlindContext({ ...context, hiddenPaths: ["task/outputs"] }), (error) => error instanceof FrontierContextCompileError && error.code === "BLIND_PATH_INVALID");
  assert.throws(() => compileBlindContext({ ...context, hiddenPaths: ["/task/inputs/nope"] }), (error) => error instanceof FrontierContextCompileError && error.code === "BLIND_PATH_INVALID");
});

test("Blind compiler redacts sibling array elements without shifting later pointers", () => {
  const revision = { ...taskRevision, inputs: [
    { artifact: "input-1", targetLabel: "first-secret" },
    { artifact: "input-2", targetLabel: "second-secret" },
  ] };
  const bundle = compileBlindContext({ taskRevision: revision, frontierSnapshot: snapshot, frontierMembers: [member], hiddenPaths: ["/task/inputs/0", "/task/inputs/1"] });
  assert.equal(Object.hasOwn(bundle.task.inputs, 0), false);
  assert.equal(Object.hasOwn(bundle.task.inputs, 1), false);
  assert.equal(JSON.stringify(bundle).includes("secret"), false);
});
