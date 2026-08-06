import assert from "node:assert/strict";
import test from "node:test";
import { VerificationContractCommandError, createVerificationContract } from "../src/verification-contract-command.mjs";

function repository() {
  const calls = [];
  const repo = { calls, withTransaction: async (callback) => callback(repo), insertVerificationContract: async (value) => { calls.push(["contract", value]); return value; }, insertVerificationContractRevision: async (value) => { calls.push(["revision", value]); return value; }, appendResearchEvent: async (value) => { calls.push(["event", value]); return value; } };
  return repo;
}
const input = { actorId: "actor-1", actorRole: "maintainer", contractId: "contract-1", requirements: { independentImplementations: 2 }, verificationTypes: ["independent_reproduction"], contextModes: ["blind"], eventFactory: async (event) => event };

test("creates a stable VerificationContract, first revision, and ResearchEvent", async () => {
  const repo = repository();
  const result = await createVerificationContract({ ...input, repository: repo });
  assert.deepEqual(result.revision, { contractId: "contract-1", revision: 1, supersedes: null, requirements: { independentImplementations: 2 }, verificationTypes: ["independent_reproduction"], contextModes: ["blind"], createdBy: "actor-1" });
  assert.equal(result.event.eventType, "verification_contract.created");
  assert.deepEqual(repo.calls.map(([type]) => type), ["contract", "revision", "event"]);
});

test("rejects malformed contract requirements and unsupported Context modes before writing", async () => {
  const repo = repository();
  await assert.rejects(() => createVerificationContract({ ...input, repository: repo, requirements: {} }), VerificationContractCommandError);
  await assert.rejects(() => createVerificationContract({ ...input, repository: repo, contextModes: ["unknown"] }), VerificationContractCommandError);
  await assert.rejects(() => createVerificationContract({ ...input, repository: repo, verificationTypes: ["reproduction", "reproduction"] }), VerificationContractCommandError);
  assert.deepEqual(repo.calls, []);
});
