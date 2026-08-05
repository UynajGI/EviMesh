import test from "node:test";
import assert from "node:assert/strict";
import { getChallenge, ChallengeQueryError } from "../src/challenge-query.mjs";

test("returns current Challenge impact and evidence linked to its target revision", async () => {
  const calls = [];
  const repository = {
    async getChallenge(challengeId) {
      calls.push(["challenge", challengeId]);
      return { challengeId, createdBy: "actor_01" };
    },
    async getCurrentChallengeRevision(challengeId) {
      calls.push(["revision", challengeId]);
      return {
        challengeId,
        revision: 2,
        state: "investigating",
        targetClaimId: "claim_01",
        targetClaimRevision: 3,
        reason: "counterexample",
        impact: { severity: "high" },
      };
    },
    async listChallengeImpacts(challengeId, revision) {
      calls.push(["impacts", challengeId, revision]);
      return [{ impactId: "impact_01", challengeId, challengeRevision: revision }];
    },
    async listEvidenceForClaimRevision(claimId, revision) {
      calls.push(["evidence", claimId, revision]);
      return [{ evidenceId: "evidence_01", claimId, claimRevision: revision, relationType: "refutes" }];
    },
  };

  const result = await getChallenge({ repository, challengeId: " challenge_01 " });

  assert.deepEqual(calls, [
    ["challenge", "challenge_01"],
    ["revision", "challenge_01"],
    ["impacts", "challenge_01", 2],
    ["evidence", "claim_01", 3],
  ]);
  assert.equal(result.currentRevision.impact.severity, "high");
  assert.equal(result.impacts[0].impactId, "impact_01");
  assert.equal(result.linkedEvidence[0].evidenceId, "evidence_01");
  assert.deepEqual(result.statusPolicy.allowedTransitions, ["upheld", "rejected", "resolved"]);
});

test("returns a not-found error without loading revision data", async () => {
  let revisionLoaded = false;
  const repository = {
    async getChallenge() { return null; },
    async getCurrentChallengeRevision() { revisionLoaded = true; },
    async listChallengeImpacts() {},
    async listEvidenceForClaimRevision() {},
  };

  await assert.rejects(
    () => getChallenge({ repository, challengeId: "challenge_missing" }),
    (error) => error instanceof ChallengeQueryError && error.code === "CHALLENGE_NOT_FOUND" && error.status === 404,
  );
  assert.equal(revisionLoaded, false);
});
