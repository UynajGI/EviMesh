import test from "node:test";
import assert from "node:assert/strict";
import { getContribution, ContributionQueryError } from "../src/contribution-query.mjs";

test("returns an Actor's roles and produced/used contribution edges", async () => {
  const calls = [];
  const repository = {
    async listContributionStatements(actorId) {
      calls.push(["statements", actorId]);
      return [
        { statementId: "statement-2", actorId, role: "reviewer", description: "Reviewed" },
        { statementId: "statement-1", actorId, role: "verifier", description: "Verified" },
      ];
    },
    async listContributionEdges(statementIds) {
      calls.push(["edges", statementIds]);
      return [
        { statementId: "statement-1", edgeType: "produced", objectType: "verification", objectId: "verification-1", objectRevision: 1 },
        { statementId: "statement-2", edgeType: "used", objectType: "claim", objectId: "claim-1", objectRevision: 2 },
      ];
    },
  };

  const result = await getContribution({ repository, actorId: " actor-1 " });

  assert.deepEqual(calls, [["statements", "actor-1"], ["edges", ["statement-2", "statement-1"]]]);
  assert.deepEqual(result.roles.map(({ role }) => role), ["reviewer", "verifier"]);
  assert.equal(result.roles[0].semantics, "reviewed scope, method, evidence, or presentation");
  assert.equal(result.produced[0].objectId, "verification-1");
  assert.equal(result.used[0].objectId, "claim-1");
});

test("returns a typed not-found error for an Actor without contribution statements", async () => {
  const repository = {
    async listContributionStatements() { return []; },
    async listContributionEdges() { throw new Error("must not load edges"); },
  };

  await assert.rejects(
    () => getContribution({ repository, actorId: "actor-missing" }),
    (error) => error instanceof ContributionQueryError && error.code === "CONTRIBUTION_NOT_FOUND" && error.status === 404,
  );
});
