import assert from "node:assert/strict";
import test from "node:test";
import { FrontierContextCompileError } from "../src/frontier-context-compiler.mjs";
import { compileAdversarialContext } from "../src/adversarial-context-compiler.mjs";

const base = {
  taskRevision: { taskId: "task-1", revision: 1, title: "Adversarial task", description: "Test the counter-case", inputs: [], outputs: {}, acceptance: {} },
  frontierSnapshot: { snapshotId: "frontier-1", projectId: "project-1", sequence: 1, projectRevision: 1, checkpoint: {} },
  frontierMembers: [
    { snapshotId: "frontier-1", claimId: "claim-main", claimRevision: 1, membershipType: "supporting", claimRevisionData: { claimId: "claim-main", revision: 1, state: "accepted", statement: "mainstream explanation", scope: {}, assumptions: [], falsification: {} } },
    { snapshotId: "frontier-1", claimId: "claim-counter", claimRevision: 2, membershipType: "counter", claimRevisionData: { claimId: "claim-counter", revision: 2, state: "contested", statement: "counter explanation", scope: {}, assumptions: [], falsification: {} } },
  ],
};

test("Adversarial compiler hides explicitly classified mainstream summaries", () => {
  const bundle = compileAdversarialContext({
    ...base,
    mainstreamClaimKeys: ["claim-main@1"],
    adversarialRelations: [{ relationType: "contradicts", sourceClaimId: "claim-counter", sourceRevision: 2, targetClaimId: "claim-main", targetRevision: 1 }],
  });
  assert.equal(bundle.mode, "adversarial");
  assert.equal(bundle.frontier.members.find((member) => member.claimId === "claim-main").claim.statement, undefined);
  assert.equal(bundle.frontier.members.find((member) => member.claimId === "claim-counter").claim.statement, "counter explanation");
  assert.equal(JSON.stringify(bundle).includes("mainstream explanation"), false);
  assert.equal(bundle.counterRelations[0].relationType, "contradicts");
});

test("Adversarial compiler rejects counter-relations outside its fixed Frontier", () => {
  assert.throws(() => compileAdversarialContext({
    ...base,
    mainstreamClaimKeys: [],
    adversarialRelations: [{ relationType: "refutes", sourceClaimId: "claim-counter", sourceRevision: 2, targetClaimId: "claim-other", targetRevision: 1 }],
  }), (error) => error instanceof FrontierContextCompileError && error.code === "ADVERSARIAL_RELATION_NOT_PINNED");
});
