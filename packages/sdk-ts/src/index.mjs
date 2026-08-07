import { createEviMeshClient } from "./client.mjs";
import { createProjectClient } from "./resources/projects.mjs";
import { createQuestionClient } from "./resources/questions.mjs";
import { createTaskClient, createAttemptClient } from "./resources/tasks.mjs";
import { createClaimClient } from "./resources/claims.mjs";
import { createArtifactClient } from "./resources/artifacts.mjs";
import { createRunClient } from "./resources/runs.mjs";
import { createEvidenceClient } from "./resources/evidence.mjs";
import { createVerificationClient } from "./resources/verifications.mjs";
import { createChallengeClient } from "./resources/challenges.mjs";
import { createFrontierClient } from "./resources/frontier.mjs";
import { createEventClient } from "./resources/events.mjs";
import { createContributionClient } from "./resources/contributions.mjs";
import { verifyMerkleInclusionProof } from "../../merkle/src/verify-inclusion-proof.mjs";
import { hashResearchEventLeaf } from "../../merkle/src/research-event-leaf.mjs";

export { createEviMeshClient } from "./client.mjs";
export * from "./errors.mjs";
export { generateIdempotencyKey } from "./idempotency.mjs";
export { iterateItems, collectItems } from "./pagination.mjs";

/** Assemble the full typed EviMesh SDK surface over one HTTP transport. */
export function createClient(options = {}) {
  const http = createEviMeshClient(options);
  const fetchImpl = options.fetchImpl ?? fetch;
  return Object.freeze({
    http,
    projects: createProjectClient(http),
    questions: createQuestionClient(http),
    tasks: createTaskClient(http),
    attempts: createAttemptClient(http),
    claims: createClaimClient(http),
    artifacts: Object.freeze({
      ...createArtifactClient(http),
      upload: async (plan, body, { fetchImpl: putFetch = fetchImpl } = {}) => {
        if (!plan || typeof plan.url !== "string") throw new TypeError("upload plan with a url is required");
        const response = await putFetch(plan.url, {
          method: "PUT",
          headers: { "content-type": plan.mediaType ?? "application/octet-stream" },
          body,
        });
        if (!response.ok) throw new Error(`artifact upload failed with status ${response.status}`);
        return { key: plan.key, url: plan.url };
      },
    }),
    runs: createRunClient(http),
    evidence: createEvidenceClient(http),
    verifications: createVerificationClient(http),
    challenges: createChallengeClient(http),
    frontier: createFrontierClient(http),
    events: createEventClient(http),
    contributions: createContributionClient(http),
    verifyEventProof: ({ proof, event = null } = {}) => {
      if (!verifyMerkleInclusionProof(proof)) return { valid: false, reason: "proof does not reconstruct its root" };
      if (event !== null) {
        const leaf = hashResearchEventLeaf(event.schema === "srp.event.v1" ? event : {
          schema: "srp.event.v1",
          event_id: event.eventId,
          event_type: event.eventType,
          payload: event.payload,
          hash: event.hash,
          signature: event.signature,
          parents: event.parents,
        });
        if (leaf !== proof.leafHash) return { valid: false, reason: "event leaf hash does not match the proof" };
      }
      return { valid: true, reason: null };
    },
  });
}
